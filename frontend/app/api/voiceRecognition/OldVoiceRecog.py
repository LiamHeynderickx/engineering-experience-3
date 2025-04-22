import speech_recognition as sr
import re
import numpy as np
import librosa
import re
import wave
import sys


def is_valid_coordinate(input_text):
    pattern = r"^[A-J](?:10|[1-9])$"
    return re.match(pattern, input_text.upper())

def process_audio(recognizer, audio_source):
    try:
        print("Processing audio...")
        audio_data = recognizer.record(audio_source)
        text = recognizer.recognize_google(audio_data)
        text = text.replace(" ", "")  # Remove spaces if any
        return text
    except sr.UnknownValueError:
        print("Sorry, I could not understand the audio. Please try again.")
    except sr.RequestError as e:
        print(f"Could not request results from Google Speech Recognition service; {e}")
    return None




def recognize_coordinates_from_mic():
    recognizer = sr.Recognizer()
    microphone = sr.Microphone()

    # print("Say a coordinate (e.g., A5):")

    while True:
        try:
            with microphone as source:
                recognizer.adjust_for_ambient_noise(source)
                # print("Listening...")
                audio = recognizer.listen(source)

            # Process and validate the recognized text
            text = recognizer.recognize_google(audio).replace(" ", "")
            if text and is_valid_coordinate(text):
                return text.upper()
            else:
                return "error"
        except sr.UnknownValueError:
            return "error"
        except sr.RequestError as e:
            return "error"

output = recognize_coordinates_from_mic()
print(output, flush=True)
