#!/bin/sh

set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 /path/to/reference-video.mp4 [output-directory]" >&2
  exit 2
fi

SOURCE="$1"
OUTPUT_DIR="${2:-public/assets/audio}"

mkdir -p "$OUTPUT_DIR"

extract_key() {
  name="$1"
  start="$2"
  ffmpeg -loglevel error -y -ss "$start" -t 0.055 -i "$SOURCE" \
    -map 0:a:0 -ac 1 -ar 44100 \
    -af "afade=t=in:st=0:d=0.003,afade=t=out:st=0.043:d=0.012" \
    -c:a pcm_s16le "$OUTPUT_DIR/$name.wav"
}

extract_key key-01 0.145
extract_key key-02 0.224
extract_key key-03 0.362
extract_key key-04 0.754
extract_key key-05 0.849
extract_key key-06 0.975
extract_key key-07 1.094
extract_key key-08 1.244

ffmpeg -loglevel error -y -ss 0.580 -t 0.065 -i "$SOURCE" \
  -map 0:a:0 -ac 1 -ar 44100 \
  -af "afade=t=in:st=0:d=0.003,afade=t=out:st=0.050:d=0.015" \
  -c:a pcm_s16le "$OUTPUT_DIR/space.wav"

ffmpeg -loglevel error -y -ss 2.040 -t 0.930 -i "$SOURCE" \
  -map 0:a:0 -ac 1 -ar 44100 \
  -af "afade=t=in:st=0:d=0.008,afade=t=out:st=0.850:d=0.080" \
  -c:a pcm_s16le "$OUTPUT_DIR/carriage.wav"

ffmpeg -loglevel error -y -ss 26.080 -t 0.430 -i "$SOURCE" \
  -map 0:a:0 -ac 1 -ar 44100 \
  -af "afade=t=in:st=0:d=0.006,afade=t=out:st=0.360:d=0.070" \
  -c:a pcm_s16le "$OUTPUT_DIR/eject.wav"
