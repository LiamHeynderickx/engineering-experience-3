# TO DO = Add examples found online that inspired the code
# + Claude 3.7 thinking mode was used to debug + add extra test cases to catch different letter pronounciations

import json
import pyaudio
import wave
import os
import re
import whisper
from datetime import datetime
import numpy as np

import torch

device = 'cuda' if torch.cuda.is_available() else 'cpu'


# block below of code is claude generated, was used to find out I dont have ffpmeg installed.
# Initialize the global whisper_model variable at module level
whisper_model = None

# Check if torchaudio is available for alternative audio processing
try:
    import torchaudio

    TORCHAUDIO_AVAILABLE = True
except ImportError:
    TORCHAUDIO_AVAILABLE = False
    print("Warning: torchaudio not available. Will use numpy for audio processing.")

# Print information about FFmpeg status
import shutil

ffmpeg_path = shutil.which("ffmpeg")
if ffmpeg_path:
    print(f"FFmpeg found at: {ffmpeg_path}")
else:
    print("WARNING: FFmpeg not found on system PATH. Using alternative audio processing.")
    print("For better results, install FFmpeg: https://ffmpeg.org/download.html")


def record_audio(duration=5, sample_rate=16000):
    """
    Record audio from the microphone for a specified duration.

    Args:
        duration (int): Recording duration in seconds
        sample_rate (int): Audio sample rate

    Returns:
        str: Path to the audio file
    """
    try:
        # Audio recording parameters
        chunk = 1024
        audio_format = pyaudio.paInt16
        channels = 1

        # Initialize PyAudio
        p = pyaudio.PyAudio()

        print("Listening... (Speak now)")

        # Open stream
        stream = p.open(format=audio_format,
                        channels=channels,
                        rate=sample_rate,
                        input=True,
                        frames_per_buffer=chunk)

        frames = []

        # Record audio in chunks
        for i in range(0, int(sample_rate / chunk * duration)):
            data = stream.read(chunk, exception_on_overflow=False)
            frames.append(data)

        print("Recording finished.")

        # Stop and close the stream
        stream.stop_stream()
        stream.close()
        p.terminate()

        # Create a fixed path for the audio file
        audio_path = os.path.join(os.getcwd(), "temp_audio.wav")

        # Save the recorded data as a WAV file
        wf = wave.open(audio_path, 'wb')
        wf.setnchannels(channels)
        wf.setsampwidth(p.get_sample_size(audio_format))
        wf.setframerate(sample_rate)
        wf.writeframes(b''.join(frames))
        wf.close()

        print(f"Audio saved to: {audio_path}")
        return audio_path

    except Exception as e:
        print(f"Error recording audio: {e}")
        return None


def recognize_with_whisper(audio_file, model_name="small"):
    """
    Recognize speech using Whisper model.

    Args:
        audio_file (str): Path to the audio file
        model_name (str): Whisper model name ('tiny', 'base', 'small', etc.)

    Returns:
        str: Recognized text
    """
    try:
        if not os.path.exists(audio_file):
            print(f"Error: Audio file not found at {audio_file}")
            return ""

        print(f"Processing audio with Whisper ({model_name} model)...")

        # Load model (only once)
        global whisper_model
        if whisper_model is None:
            print(f"Loading Whisper {model_name} model (this may take a moment the first time)...")
            whisper_model = whisper.load_model(model_name).to(device)
            print("Model loaded successfully.")

        # Load audio file using wave instead of relying on FFmpeg
        try:
            # Read the wave file directly instead of using whisper's load_audio
            import numpy as np
            with wave.open(audio_file, 'rb') as wf:
                # Get audio parameters
                channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                sample_rate = wf.getframerate()
                n_frames = wf.getnframes()

                # Read all frames
                audio_bytes = wf.readframes(n_frames)

                # Convert to numpy array
                if sample_width == 2:  # 16-bit audio
                    audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
                else:
                    print(f"Unsupported sample width: {sample_width}")
                    return ""

                # Convert to float32 and normalize to [-1, 1]
                audio_data = audio_data.astype(np.float32) / 32768.0

                # If stereo, convert to mono
                if channels == 2:
                    audio_data = audio_data.reshape(-1, 2).mean(axis=1)

                # Resample to 16000 Hz if needed (Whisper expects 16kHz)
                if sample_rate != 16000:
                    print(f"Warning: Audio sample rate is {sample_rate}Hz, not 16000Hz. Resampling may be required.")
                    # Simple resampling by linear interpolation
                    if sample_rate > 16000:
                        # Downsample
                        ratio = sample_rate / 16000
                        audio_data = audio_data[::int(ratio)]
                    else:
                        # Upsample (not ideal but better than nothing)
                        ratio = 16000 / sample_rate
                        audio_data = np.repeat(audio_data, int(ratio))

            # Transcribe audio using the prepared numpy array
            result = whisper_model.transcribe(audio_data, fp16=False, language='English')
            text = result["text"].strip()

            print(f"Transcription successful: '{text}'")

            # Clean up temp file
            try:
                os.remove(audio_file)
                print("Temporary audio file deleted.")
            except Exception as e:
                print(f"Warning: Could not delete temp file: {e}")

            return text

        except Exception as inner_e:
            print(f"Error processing audio directly: {inner_e}")
            print("Trying alternative method...")

            # Alternative fallback: Use torch to load audio
            try:
                import torchaudio
                waveform, sample_rate = torchaudio.load(audio_file)
                # Convert to mono and correct sample rate if needed
                if waveform.shape[0] > 1:  # If multi-channel, convert to mono
                    waveform = waveform.mean(dim=0, keepdim=True)
                if sample_rate != 16000:
                    resampler = torchaudio.transforms.Resample(sample_rate, 16000)
                    waveform = resampler(waveform)

                # Convert to numpy array
                audio_data = waveform.squeeze().numpy()

                # Transcribe
                result = whisper_model.transcribe(audio_data, fp16=False, language='English')
                text = result["text"].strip()

                print(f"Transcription successful (alternative method): '{text}'")
                return text
            except Exception as torch_e:
                print(f"Alternative method also failed: {torch_e}")
                raise

    except Exception as e:
        print(f"Error in speech recognition: {e}")
        import traceback
        traceback.print_exc()
        return ""


def parse_battleship_coordinates(text):
    """
    Extract battleship coordinates from recognized text with enhanced parsing.

    Args:
        text (str): Recognized text

    Returns:
        list: List of extracted coordinates
    """
    if not text:
        return []

    # Convert text to uppercase
    text = text.upper()

    print(f"Parsing text for coordinates: '{text}'")

    # Regular expression to find battleship coordinates
    # This pattern looks for:
    # - A letter A-J (for rows)
    # - Followed by a number 1-10 (for columns)
    # - With optional spaces between
    pattern = r'([A-J])\s*?(10|[1-9])'

    # Find all matches
    matches = re.findall(pattern, text)

    # Combine the matches back into coordinates
    coordinates = [''.join(match) for match in matches]

    # Example substitutions added below
    substitutions = {
        # A substitutions
        'HA': 'A', 'KA': 'A', 'CA': 'A', 'AA': 'A', 'AY': 'A', 'EI': 'A', 'ACE': 'A', 'ALPHA': 'A',

        # B substitutions
        'BEE': 'B', 'BE': 'B', 'PEE': 'B', 'PETE': 'B', 'BRAVO': 'B', 'BEETLE': 'B', 'BEAT': 'B', 'BETA': 'B',

        # C substitutions
        'SEE': 'C', 'SEA': 'C', 'SI': 'C', 'CHARLIE': 'C', 'SIGHT': 'C', 'CESAR': 'C', 'SEAT': 'C',

        # D substitutions
        'DEE': 'D', 'DE': 'D', 'THE': 'D', 'DELTA': 'D', 'DEEP': 'D', 'DEAN': 'D', 'DEAL': 'D', 'DI': 'D',

        # E substitutions
        'HE': 'E', 'ME': 'E', 'ECHO': 'E', 'EAT': 'E', 'EASY': 'E', 'EVEN': 'E', 'EACH': 'E',

        # F substitutions
        'F': 'F', 'EF': 'F', 'IF': 'F', 'FOXTROT': 'F', 'EFFORT': 'F', 'HALF': 'F', 'LEAF': 'F',

        # G substitutions
        'G': 'G', 'GE': 'G', 'JEE': 'G', 'GOLF': 'G', 'JEEP': 'G', 'JI': 'G', 'GENE': 'G', 'JEEZ': 'G',

        # H substitutions
        'H': 'H', 'AGE': 'H', 'ITCH': 'H', 'HOTEL': 'H', 'AITCH': 'H', 'HEDGE': 'H', 'ETCH': 'H', 'HITCH': 'H',

        # I substitutions
        'I': 'I', 'EYE': 'I', 'AI': 'I', 'INDIA': 'I', 'WHY': 'I', 'IVE': 'I', 'AYE': 'I', 'HIGH': 'I',

        # J substitutions
        'J': 'J', 'JAY': 'J', 'JULIET': 'J', 'GEE': 'J', 'JET': 'J', 'JANE': 'J', 'JAIL': 'J', 'JAKE': 'J'
    }

    # Split text into words
    words = text.replace('.', ' ').replace(',', ' ').split()

    # Check for numerical mentions
    number_words = {
        'ONE': '1', 'WON': '1', 'ONCE': '1', 'WANT': '1',
        'TU': '2', 'TWO': '2', 'TO': '2', 'TOO': '2', 'TUNE': '2', 'TOOTH': '2', 'YOU': '2',
        'THREE': '3', 'TREE': '3', 'FREE': '3', 'DECREE': '3',
        'FOUR': '4', 'FOR': '4', 'FORE': '4', 'FLOOR': '4', 'FOURTH': '4',
        'FIVE': '5', 'HIVE': '5', 'FIFE': '5', 'FIGHT': '5', 'FIFTH': '5',
        'SIX': '6', 'SICKS': '6', 'STICKS': '6', 'SICK': '6', 'SIXTH': '6',
        'SEVEN': '7', 'HEAVEN': '7', 'KEVIN': '7', 'SEVERAL': '7', 'SEVENTH': '7',
        'EIGHT': '8', 'ATE': '8', 'HATE': '8', 'FATE': '8', 'EIGHTH': '8',
        'NINE': '9', 'WINE': '9', 'LINE': '9', 'SIGN': '9', 'NINTH': '9',
        'TEN': '10', 'TENT': '10', 'TENTH': '10'
    }

    # Process each word to find potential coordinates
    for i, word in enumerate(words):
        # Check if this word is a letter substitute
        for sub_key, sub_value in substitutions.items():
            if word == sub_key:
                # Check if next word is a number or number word
                if i + 1 < len(words):
                    next_word = words[i + 1]

                    # Direct number
                    if next_word.isdigit() and 1 <= int(next_word) <= 10:
                        coordinates.append(f"{sub_value}{next_word}")

                    # Number word
                    elif next_word in number_words:
                        coordinates.append(f"{sub_value}{number_words[next_word]}")

    # Look for specific patterns like "B4" pronounced as "BEFORE"
    special_cases = {
        'BEFORE': 'B4', 'BEFOUR': 'B4', 'SEE YOU TOO': 'C2','SEE YOU': 'C2', 'BEE FOUR': 'B4', 'BE FOUR': 'B4', 'BEEF OR': 'B4', 'BE FOR': 'B4',
        'SEA TOO': 'C2', 'SEE TOO': 'C2', 'SEE TWO': 'C2', 'SEA TWO': 'C2', 'SEAT OO': 'C2', 'SEAT WO': 'C2',
        'ATE': 'A8', 'A ATE': 'A8', 'HATE': 'H8', 'GATE': 'G8', 'FATE': 'F8', 'DATE': 'D8',
        'BENIGN': 'B9', 'SEIZE': 'C6', 'SEAVEN': 'C7', 'DEFEAT': 'D8', 'EFIVE': 'E5', 'EVEN': 'E1',
        'AFORE': 'A4', 'AFIVE': 'A5', 'BETEN': 'B10', 'BIONE': 'B1', 'BITOO': 'B2',
        'DEFORE': 'D4', 'DEFIVE': 'D5', 'DETOO': 'D2', 'DETHREE': 'D3',
        'EYETEN': 'I10', 'EYEFIVE': 'I5', 'EYEONE': 'I1', 'JAYONE': 'J1', 'JAYTOO': 'J2'
    }

    # Additional phonetic parsing by scanning through the text for combined sounds
    phonetic_patterns = [
        (r'([AEI])\s*WON', r'\g<1>1'),  # A WON -> A1
        (r'([BCDEFGHIJ])[EI]+\s+WON', r'\g<1>1'),  # BEE WON -> B1
        (r'SEE\s+WON', 'C1'),  # SEE WON -> C1
        (r'DEE\s+TOO', 'D2'),  # DEE TOO -> D2
        (r'([ABCDEFGHIJ])\s+TREE', r'\g<1>3'),  # A TREE -> A3
        (r'TARGET\s+([ABCDEFGHIJ])[\s-]*([1-9]|10|TEN|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)', r'\g<1>\g<2>'),
        # TARGET A1 -> A1
        (r'FIRE\s+AT\s+([ABCDEFGHIJ])[\s-]*([1-9]|10|TEN|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)', r'\g<1>\g<2>'),
        # FIRE AT B5 -> B5
        (r'SHOOT\s+([ABCDEFGHIJ])[\s-]*([1-9]|10|TEN|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)', r'\g<1>\g<2>')
        # SHOOT C3 -> C3
    ]

    # Apply phonetic patterns
    for pattern, replacement in phonetic_patterns:
        matches = re.findall(pattern, text)
        if matches:
            for match in matches:
                if isinstance(match, tuple):
                    # Handle tuple matches from capturing groups
                    letter = match[0]
                    number = match[1]

                    # Convert number words to digits if needed
                    if number in number_words:
                        number = number_words[number]

                    coordinates.append(f"{letter}{number}")
                else:
                    # Handle string replacement
                    coordinates.append(replacement)

    # For "a1", "b2", etc. that might be lowercase in the original text
    lowercase_pattern = r'([a-j])\s*?(10|[1-9])'
    lowercase_matches = re.findall(lowercase_pattern, text.lower())
    lowercase_coords = [f"{match[0].upper()}{match[1]}" for match in lowercase_matches]
    coordinates.extend(lowercase_coords)

    # Remove duplicates and ensure all coordinates are valid
    unique_coords = []
    for coord in coordinates:
        # Process word substitutions in the coordinate if they exist
        # For example, if coord is "BONE", it should be processed as "B1"
        if len(coord) > 2 and coord not in special_cases.keys():
            for num_word, num_val in number_words.items():
                if num_word in coord:
                    # Try to extract the letter part
                    letter_part = coord[0]
                    if letter_part in 'ABCDEFGHIJ':
                        potential_coord = f"{letter_part}{num_val}"
                        if potential_coord not in unique_coords:
                            unique_coords.append(potential_coord)

        # Standard validation
        if coord not in unique_coords and len(coord) >= 2:
            if coord[0] in 'ABCDEFGHIJ' and coord[1:] in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']:
                unique_coords.append(coord)

    return unique_coords


def create_json_output(coordinates):
    """
    Create JSON output from extracted coordinates.

    Args:
        coordinates (list): List of coordinates

    Returns:
        str: JSON string
    """
    output = {
        "timestamp": datetime.now().isoformat(),
        "coordinates": coordinates
    }

    return json.dumps(output, indent=2)


def save_json_output(json_output, auto_save=True):
    """
    Save JSON output to a file.

    Args:
        json_output (str): JSON string to save
        auto_save (bool): Whether to automatically save without asking

    Returns:
        str: Path to the saved file or None if not saved
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"battleship_coordinates_{timestamp}.json"

    if auto_save:
        # Automatically save without asking
        with open(filename, 'w') as f:
            f.write(json_output)
        print(f"JSON automatically saved to: {filename}")
        return filename
    else:
        # Ask user if they want to save
        save = input("\nSave this output to a file? (y/n): ")
        if save.lower() == 'y':
            with open(filename, 'w') as f:
                f.write(json_output)
            print(f"Saved to {filename}")
            return filename

    return None


def main():
    print("\n======================================")
    print("  BATTLESHIP VOICE COMMAND RECOGNIZER  ")
    print("======================================")
    print("This program recognizes battleship coordinates (A1-J10) from your voice.")
    print("Speak clearly into your microphone when prompted.")
    print("Examples: 'A1', 'B5', 'J10', 'Fire at C7', etc.")
    print("======================================\n")

    # Pre-load the whisper model
    print("Initializing Whisper model...")
    global whisper_model
    whisper_model = whisper.load_model("small").to(device)
    print("Whisper model initialized successfully!")

    # Configuration options
    auto_export_json = True  # Set to True to automatically export JSON files

    # Ask user if they want to auto-export JSON
    auto_export_choice = input("Do you want to automatically export JSON files? (y/n, default: y): ")
    if auto_export_choice.lower() == 'n':
        auto_export_json = False

    # Store session statistics
    session_data = {
        "successful_recognitions": 0,
        "failed_recognitions": 0,
        "exported_files": []
    }

    try:
        while True:
            print("\n----------------------------------")
            input("Press Enter to start recording...")

            # Record audio
            audio_file = record_audio(duration=5)
            if not audio_file:
                print("Failed to record audio. Please try again.")
                session_data["failed_recognitions"] += 1
                continue

            # Recognize speech
            text = recognize_with_whisper(audio_file)

            if text:
                print(f"Recognized text: '{text}'")

                # Parse coordinates
                coordinates = parse_battleship_coordinates(text)

                if coordinates:
                    print(f"✓ Successfully extracted coordinates: {coordinates}")
                    session_data["successful_recognitions"] += 1

                    # Create JSON output
                    json_output = create_json_output(coordinates)
                    print("\nJSON Output:")
                    print(json_output)

                    # Save JSON output (automatically if configured to do so)
                    saved_file = save_json_output(json_output, auto_save=auto_export_json)
                    if saved_file:
                        session_data["exported_files"].append(saved_file)
                else:
                    print("❌ No battleship coordinates found in the speech.")
                    session_data["failed_recognitions"] += 1
                    print("Tips:")
                    print("- Try speaking more clearly")
                    print("- Say coordinates like 'A1', 'B5', 'C10'")
                    print("- Try phrases like 'Fire at D4' or 'Target E5'")
            else:
                print("❌ No speech detected or recognized.")
                session_data["failed_recognitions"] += 1
                print("Tips:")
                print("- Speak louder or closer to the microphone")
                print("- Make sure your microphone isn't muted")
                print("- Try speaking for longer (2-3 seconds)")

            # Show session statistics
            total_attempts = session_data["successful_recognitions"] + session_data["failed_recognitions"]
            if total_attempts > 0:
                success_rate = (session_data["successful_recognitions"] / total_attempts) * 100
                print(
                    f"\nSession stats: {session_data['successful_recognitions']} successful recognitions out of {total_attempts} attempts ({success_rate:.1f}% success rate)")
                print(f"Files exported: {len(session_data['exported_files'])}")

            # Ask if the user wants to continue
            cont = input("\nContinue? (y/n): ")
            if cont.lower() != 'y':
                break

    except KeyboardInterrupt:
        print("\nExiting program.")
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Clean up any remaining temp files
        if os.path.exists("temp_audio.wav"):
            try:
                os.remove("temp_audio.wav")
            except:
                pass

        # Show summary of files exported
        if session_data["exported_files"]:
            print("\n======================================")
            print("  FILES EXPORTED  ")
            print("======================================")
            for file_path in session_data["exported_files"]:
                print(f"- {file_path}")
            print(f"Total: {len(session_data['exported_files'])} files")

if __name__ == "__main__":
    main()