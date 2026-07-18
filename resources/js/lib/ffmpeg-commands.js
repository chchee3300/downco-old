// Extracted unchanged (logic-for-logic) from resources/js/main.js's execute
// handler. Framework-agnostic strangler-fig seam: the future React port
// imports these unchanged — see design-system/MASTER.md do-not-touch list.
// Do NOT alter the string-building here without a dedicated CLAUDE.md review;
// these must stay byte-identical to pre-migration output for every code path
// that predates the Photo Crop feature. buildImageCommand's `crop` param is a
// deliberate, reviewed addition (not migration drift) — see its own comment.
// The ffmpeg binary path fragment is routed through
// window.EstellaLib.platform.ffmpegPath(binPath) (cross-platform seam) —
// also a reviewed, deliberate change, not migration drift.
(function (global) {
  // Shared by buildVideoCommand/buildAudioCommand below (buildImageCommand
  // has no timeline, so no trim concept) -- both built the exact same
  // -ss/-to flag string independently before this extraction.
  function buildTrimFlags(fileObj) {
    let trimCmd = '';
    if (fileObj.trimStart !== undefined) trimCmd += `-ss ${fileObj.trimStart} `;
    if (fileObj.trimEnd !== undefined) trimCmd += `-to ${fileObj.trimEnd} `;
    return trimCmd;
  }

  // fileObj: { fps, duration, size, trimStart, trimEnd } (subset of the app's file record)
  function buildVideoCommand({ binPath, file, outPath, format, codec, qualityPercent, speed, targetFpsStr, fileObj }) {
    const targetFps = targetFpsStr === 'original' ? fileObj.fps : parseFloat(targetFpsStr);
    const fps = targetFpsStr;

    const trimCmd = buildTrimFlags(fileObj);

    if (format === '.gif') {
      let filterGraph = [];
      if (targetFps) filterGraph.push(`fps=${targetFps}`);

      const speedFloat = parseFloat(speed);
      if (speedFloat !== 1.0) filterGraph.push(`setpts=${1 / speedFloat}*PTS`);

      let scaleFactor = qualityPercent / 100;
      if (scaleFactor < 1.0) {
        filterGraph.push(`scale=trunc(iw*${scaleFactor}/2)*2:-2:flags=lanczos`);
      }

      let preFilters = filterGraph.length > 0 ? filterGraph.join(',') + ',' : '';
      let fullFilter = `${preFilters}split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

      return `"${global.EstellaLib.platform.ffmpegPath(binPath)}" -y ${trimCmd}-i "${file}" -filter_complex "${fullFilter}" "${outPath}"`;
    }

    let fpsFactor = 1.0;
    if (targetFps && fileObj.fps) {
      fpsFactor = targetFps / fileObj.fps;
    }

    let targetBitrateCmd = '';
    if (fileObj.duration > 0) {
      const originalBitrateKbps = (fileObj.size * 8) / (fileObj.duration * 1024);
      const targetBitrateKbps = Math.max(10, Math.floor(originalBitrateKbps * (qualityPercent / 100) * fpsFactor));
      targetBitrateCmd = `-b:v ${targetBitrateKbps}k -bufsize ${targetBitrateKbps * 2}k`;
    } else {
      const crf = 51 - Math.round((qualityPercent / 100) * 51);
      targetBitrateCmd = `-crf ${crf}`;
    }

    let extraFilters = [];
    let audioFilters = [];

    if (fps !== 'original') {
      extraFilters.push(`fps=${fps}`);
    }

    if (speed !== '1.0' && speed !== '1') {
      const speedFloat = parseFloat(speed);
      const ptsRatio = 1 / speedFloat;
      extraFilters.push(`setpts=${ptsRatio}*PTS`);
      audioFilters.push(`atempo=${speedFloat}`);
    }

    let filterCmd = '';
    if (extraFilters.length > 0) {
      filterCmd += `-vf "${extraFilters.join(',')}" `;
    }
    if (audioFilters.length > 0) {
      filterCmd += `-af "${audioFilters.join(',')}" `;
    }

    return `"${global.EstellaLib.platform.ffmpegPath(binPath)}" -y ${trimCmd}-i "${file}" -c:v ${codec} ${filterCmd}${targetBitrateCmd} "${outPath}"`;
  }

  // crop: { x, y, width, height } in the source image's natural pixel
  // coordinates, or undefined for no crop. Always applied *before* scale in
  // the filter chain (crop the region first, then resize what's left) --
  // every branch below joins crop ahead of scale/the .ico mandatory cap via
  // joinFilters.
  function buildImageCommand({ binPath, file, outPath, format, quality, scale, crop }) {
    let qCmd = '';
    let filterCmd = '';

    if (format === '.jpg' || format === '.jpeg') {
      let qv = Math.max(2, Math.min(31, 31 - Math.round((quality / 100) * 29)));
      qCmd = `-q:v ${qv}`;
    } else if (format === '.webp') {
      qCmd = `-q:v ${quality}`;
    }

    const joinFilters = (...parts) => parts.filter(Boolean).join(',');

    let cropFilter = '';
    if (crop && crop.width && crop.height) {
      cropFilter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`;
    }

    let scaleFilter = '';
    if (scale < 100) {
      let scaleFactor = scale / 100;
      scaleFilter = `scale=trunc(iw*${scaleFactor}/2)*2:-2:flags=lanczos`;
    }

    const cropAndScale = joinFilters(cropFilter, scaleFilter);

    if (format === '.ico') {
      // ffmpeg's ico muxer hard-caps output at 256x256 -- anything larger
      // fails outright with "Unsupported dimensions" (confirmed against
      // the bundled binary). Always fit-within-256 regardless of the
      // scale slider, which is honored as an *additional* reduction
      // chained in front of the mandatory cap (unlike every other format,
      // where the scale filter only applies when scale < 100). Crop (if
      // any) goes in front of both, same as everywhere else.
      const preScale = cropAndScale ? `${cropAndScale},` : '';
      filterCmd = `-vf "${preScale}scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease"`;
    } else if (format === '.png' && quality < 100) {
      let colors = Math.max(2, Math.floor(256 * (quality / 100)));
      if (cropAndScale) {
        filterCmd = `-filter_complex "[0:v]${cropAndScale}[s];[s]split[a][b];[a]palettegen=max_colors=${colors}[p];[b][p]paletteuse"`;
      } else {
        filterCmd = `-filter_complex "[0:v]split[a][b];[a]palettegen=max_colors=${colors}[p];[b][p]paletteuse"`;
      }
    } else if (cropAndScale) {
      filterCmd = `-vf "${cropAndScale}"`;
    }

    return `"${global.EstellaLib.platform.ffmpegPath(binPath)}" -y -i "${file}" ${filterCmd} ${qCmd} "${outPath}"`;
  }

  // fileObj: { trimStart, trimEnd }
  function buildAudioCommand({ binPath, file, outPath, bitrate, speed, format, fileObj }) {
    let filterCmd = '';
    const speedFloat = parseFloat(speed);
    if (speedFloat !== 1.0) {
      filterCmd = `-af "atempo=${speedFloat}" `;
    }

    const trimCmd = buildTrimFlags(fileObj);

    // Explicit rather than relying on ffmpeg's default muxer-implied encoder
    // choice for .ogg — every other format keeps codecCmd === '' (unchanged).
    const codecCmd = format === '.ogg' ? '-c:a libvorbis ' : '';

    return `"${global.EstellaLib.platform.ffmpegPath(binPath)}" -y ${trimCmd}-i "${file}" ${filterCmd}${codecCmd}-b:a ${bitrate} "${outPath}"`;
  }

  // File-list thumbnail preview (video mid-frame / audio embedded cover art /
  // downscaled image), all funneled through one 160px-wide JPEG output so
  // FileList.jsx has a single, uniform src regardless of fileType. `-an` on
  // the audio branch is what makes ffmpeg treat an embedded picture stream
  // (ID3/Vorbis cover art) as the thing to decode as a frame instead of
  // erroring on "multiple streams" -- if the audio file has no embedded art,
  // this command exits non-zero and the caller treats that as "no thumbnail"
  // (same fallback as a video/image that fails to probe).
  function buildThumbnailCommand({ binPath, file, outPath, fileType, duration }) {
    const ffmpeg = `"${global.EstellaLib.platform.ffmpegPath(binPath)}"`;
    const scale = '-vf "scale=160:-1"';

    if (fileType === 'video') {
      const mid = duration > 0 ? duration / 2 : 0;
      return `${ffmpeg} -y -ss ${mid} -i "${file}" -frames:v 1 ${scale} "${outPath}"`;
    }
    if (fileType === 'audio') {
      return `${ffmpeg} -y -i "${file}" -an ${scale} -frames:v 1 "${outPath}"`;
    }
    return `${ffmpeg} -y -i "${file}" -frames:v 1 ${scale} "${outPath}"`;
  }

  global.EstellaLib = global.EstellaLib || {};
  global.EstellaLib.ffmpegCommands = { buildVideoCommand, buildImageCommand, buildAudioCommand, buildThumbnailCommand };
})(window);
