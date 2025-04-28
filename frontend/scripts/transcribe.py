#!/usr/bin/env python3
import sys, json
import whisper



def main():
    audio_path = sys.argv[1]
    model = whisper.load_model("small")          # or “tiny”, “base”…
    options = {
        "fp16": False,
        "language": "en",
        "beam_size": 5,
        "initial_prompt": "Battleship game coordinates A through J, numbers 1 through 10"
    }
    result = model.transcribe(audio_path, **options)
    print(json.dumps({ "text": result["text"].strip() }))

if __name__ == "__main__":
    main()
