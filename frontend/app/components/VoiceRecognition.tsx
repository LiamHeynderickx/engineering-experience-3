'use client'

import React, { useState, useEffect, useRef } from 'react';

// Define TypeScript interfaces for Speech Recognition API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  error?: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

// Extend Window interface to include SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// NATO phonetic alphabet mapping
const natoAlphabet: Record<string, string> = {
  'alpha': 'a',
  'bravo': 'b',
  'charlie': 'c',
  'delta': 'd',
  'echo': 'e',
  'foxtrot': 'f',
  'golf': 'g',
  'hotel': 'h',
  'india': 'i',
  'juliet': 'j',
  'juliett': 'j', // Alternative spelling
  'julie': 'j',   // Common misrecognition
  'julius': 'j',  // Common misrecognition
  // Common speech recognition variants
  'alfa': 'a',
  'bracket': 'b',
  'charli': 'c',
  'fox': 'f',
  'fox trot': 'f',
};

// Number word mapping
const numberWords: Record<string, string> = {
  'one': '1',
  'two': '2',
  'three': '3',
  'four': '4',
  'five': '5',
  'six': '6',
  'seven': '7',
  'eight': '8',
  'nine': '9',
  'ten': '10',
  // Common misrecognitions
  'for': '4',
  'to': '2',
  'too': '2',
  'tree': '3',
  'free': '3',
  'won': '1',
};

// Valid columns and rows for battleship
const validColumns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const validRows = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// Component Props
interface VoiceRecognitionProps {
  onResult: (coordinate: string) => void;
  onError: (message: string) => void;
  isEnabled: boolean;
  language?: string;
}

const VoiceRecognition: React.FC<VoiceRecognitionProps> = ({ 
  onResult, 
  onError, 
  isEnabled = true,
  language = 'en-US'
}) => {
  const [isListening, setIsListening] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [alwaysListening, setAlwaysListening] = useState(true); // Always on by default
  const [recognitionState, setRecognitionState] = useState<'idle' | 'listening' | 'processing' | 'cooldown'>('idle');
  const [showVisualFeedback, setShowVisualFeedback] = useState(false);
  const [inputMode, setInputMode] = useState<'column' | 'row'>('column');
  const [partialCoordinate, setPartialCoordinate] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const visualFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const coordinateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Parse transcript to extract valid battleship coordinates
  const parseCoordinate = (transcript: string): { valid: boolean; message: string; coordinate?: string } => {
    // Remove periods, commas, and extra spaces
    const cleanedTranscript = transcript.toLowerCase().replace(/[.,]/g, '').trim();
    console.log(`Parsing transcript: "${cleanedTranscript}"`);
    
    // If we're in column mode, look for a valid column letter (A-J)
    if (inputMode === 'column') {
      // Check for single letter
      if (cleanedTranscript.length === 1 && validColumns.includes(cleanedTranscript)) {
        return { valid: true, message: 'Valid column', coordinate: cleanedTranscript.toUpperCase() };
      }
      
      // Check for NATO phonetic alphabet
      for (const [nato, letter] of Object.entries(natoAlphabet)) {
        if (cleanedTranscript.includes(nato) && validColumns.includes(letter)) {
          return { valid: true, message: 'Valid NATO column', coordinate: letter.toUpperCase() };
        }
      }
      
      // Check for formats like "column a" or "letter b"
      const letterPrefixMatch = cleanedTranscript.match(/(column|letter|call)\s+([a-j])/i);
      if (letterPrefixMatch && validColumns.includes(letterPrefixMatch[2])) {
        return { valid: true, message: 'Valid prefixed column', coordinate: letterPrefixMatch[2].toUpperCase() };
      }
      
      return { valid: false, message: 'Please say a valid column letter (A through J) or its NATO equivalent (Alpha, Bravo, etc.)' };
    }
    
    // If we're in row mode, look for a valid row number (1-10)
    if (inputMode === 'row') {
      // Check for direct number
      if (validRows.includes(cleanedTranscript)) {
        return { valid: true, message: 'Valid row', coordinate: cleanedTranscript };
      }
      
      // Check for number words
      for (const [word, num] of Object.entries(numberWords)) {
        if (cleanedTranscript.includes(word) && validRows.includes(num)) {
          return { valid: true, message: 'Valid number word row', coordinate: num };
        }
      }
      
      // Check for formats like "row 5" or "number 7"
      const numberPrefixMatch = cleanedTranscript.match(/(row|number|position)\s+(\d+)/i);
      if (numberPrefixMatch && validRows.includes(numberPrefixMatch[2])) {
        return { valid: true, message: 'Valid prefixed row', coordinate: numberPrefixMatch[2] };
      }
      
      return { valid: false, message: `Please say a valid row number (1 through 10) for column ${partialCoordinate}` };
    }
    
    return { valid: false, message: 'Invalid input mode' };
  };
  
  // Check for a complete coordinate in a single utterance
  const checkForCompleteCoordinate = (transcript: string): { valid: boolean; coordinate?: string } => {
    // Clean the transcript
    const cleanedTranscript = transcript.toLowerCase().replace(/[.,]/g, '').trim();
    
    // Try to match patterns like "A5", "Alpha 7", "B 10", etc.
    let column = null;
    let row = null;
    
    // Check for single letter
    if (cleanedTranscript.length >= 2) {
      const firstChar = cleanedTranscript[0];
      if (validColumns.includes(firstChar)) {
        column = firstChar.toUpperCase();
        
        // Get the rest as potential row
        const remainingPart = cleanedTranscript.substring(1).trim();
        if (validRows.includes(remainingPart)) {
          row = remainingPart;
        }
      }
    }
    
    // Check for NATO alphabet format like "Alpha 5"
    if (!column || !row) {
      for (const [nato, letter] of Object.entries(natoAlphabet)) {
        if (cleanedTranscript.startsWith(nato) && validColumns.includes(letter)) {
          column = letter.toUpperCase();
          
          // Get the rest as potential row
          const remainingPart = cleanedTranscript.substring(nato.length).trim();
          if (validRows.includes(remainingPart)) {
            row = remainingPart;
          }
          
          // Check for number words in the remaining part
          for (const [word, num] of Object.entries(numberWords)) {
            if (remainingPart === word && validRows.includes(num)) {
              row = num;
              break;
            }
          }
          
          break;
        }
      }
    }
    
    // Check for successful match
    if (column && row) {
      return { valid: true, coordinate: `${column}${row}` };
    }
    
    return { valid: false };
  };

  // Start listening automatically when component mounts or when enabled changes
  useEffect(() => {
    if (isEnabled && alwaysListening && permissionStatus === 'granted' && recognitionState === 'idle') {
      startListening(false); // Start without visual feedback for auto-listening
    }
  }, [isEnabled, alwaysListening, recognitionState, permissionStatus]);

  useEffect(() => {
    // Check for Speech Recognition support
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        recognitionRef.current = new SpeechRecognitionAPI();
        
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = language;
        
        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          setRecognitionState('processing');
          console.log('Speech recognition got result');
          
          if (event.results && event.results.length > 0) {
            const transcript = event.results[0][0].transcript.trim();
            console.log(`Raw transcript: "${transcript}"`);
            
            // First, check if the entire transcript is a complete coordinate
            const completeCheck = checkForCompleteCoordinate(transcript);
            if (completeCheck.valid && completeCheck.coordinate) {
              console.log(`Detected complete coordinate: ${completeCheck.coordinate}`);
              // Complete coordinate detected, send to callback
              onResult(completeCheck.coordinate);
              
              // Reset for next coordinate
              setInputMode('column');
              setPartialCoordinate(null);
              
              // Show visual feedback briefly
              setShowVisualFeedback(true);
              if (visualFeedbackTimeoutRef.current) {
                clearTimeout(visualFeedbackTimeoutRef.current);
              }
              visualFeedbackTimeoutRef.current = setTimeout(() => {
                setShowVisualFeedback(false);
              }, 1500);
            } else {
              // Not a complete coordinate, check for partial based on current mode
              const result = parseCoordinate(transcript);
              
              if (result.valid && result.coordinate) {
                if (inputMode === 'column') {
                  console.log(`Valid column detected: ${result.coordinate}`);
                  // Store the column and switch to row mode
                  setPartialCoordinate(result.coordinate);
                  setInputMode('row');
                  
                  // Set a timeout to reset if no row is provided
                  if (coordinateTimeoutRef.current) {
                    clearTimeout(coordinateTimeoutRef.current);
                  }
                  coordinateTimeoutRef.current = setTimeout(() => {
                    console.log('Coordinate input timed out, resetting');
                    setInputMode('column');
                    setPartialCoordinate(null);
                  }, 10000); // 10 seconds to provide the row
                  
                  // Provide feedback
                  onError(`Column ${result.coordinate} selected. Please say a row number (1-10).`);
                } else if (inputMode === 'row' && partialCoordinate) {
                  console.log(`Valid row detected: ${result.coordinate}`);
                  // Combine with the stored column to form a complete coordinate
                  const fullCoordinate = `${partialCoordinate}${result.coordinate}`;
                  console.log(`Complete coordinate: ${fullCoordinate}`);
                  
                  // Send the complete coordinate to the callback
                  onResult(fullCoordinate);
                  
                  // Reset for next coordinate
                  setInputMode('column');
                  setPartialCoordinate(null);
                  
                  // Clear the coordinate timeout
                  if (coordinateTimeoutRef.current) {
                    clearTimeout(coordinateTimeoutRef.current);
                    coordinateTimeoutRef.current = null;
                  }
                }
              } else {
                // Invalid input for current mode
                onError(result.message);
              }
            }
            
            // Show visual feedback briefly
            setShowVisualFeedback(true);
            if (visualFeedbackTimeoutRef.current) {
              clearTimeout(visualFeedbackTimeoutRef.current);
            }
            visualFeedbackTimeoutRef.current = setTimeout(() => {
              setShowVisualFeedback(false);
            }, 1500);
          }
          
          setIsListening(false);
          
          // Clear timeout after receiving results
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          // Add cooldown before restarting to prevent rapid fire recognition
          if (alwaysListening && isEnabled) {
            console.log('Setting cooldown before next recognition');
            setRecognitionState('cooldown');
            
            if (cooldownRef.current) {
              clearTimeout(cooldownRef.current);
            }
            
            cooldownRef.current = setTimeout(() => {
              console.log('Cooldown complete, ready for next recognition');
              setRecognitionState('idle');
              startListening(false); // Restart without visual feedback
            }, 1500); // Shorter delay between recognitions for better responsiveness
          } else {
            setRecognitionState('idle');
          }
        };
        
        recognitionRef.current.onerror = (event: SpeechRecognitionEvent) => {
          console.error('Speech recognition error', event.error);
          
          if (event.error === 'not-allowed') {
            setPermissionStatus('denied');
            onError('Microphone access denied');
            setRecognitionState('idle');
          } else if (event.error === 'no-speech') {
            // Don't show no-speech errors in always-listening mode
            if (!alwaysListening) {
              onError('No speech detected. Please try again.');
            }
            setRecognitionState('idle');
          } else if (event.error === 'aborted') {
            // Don't show error for normal aborts
            console.log('Speech recognition was aborted');
            setRecognitionState('idle');
          } else {
            onError(`Error: ${event.error || 'Unknown error'}`);
            setRecognitionState('idle');
          }
          
          setIsListening(false);
          
          // Clear timeout after error
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          // Restart listening on non-fatal errors if always listening is enabled
          if (alwaysListening && isEnabled && event.error !== 'not-allowed') {
            console.log('Setting cooldown after error before next recognition');
            setRecognitionState('cooldown');
            
            if (cooldownRef.current) {
              clearTimeout(cooldownRef.current);
            }
            
            cooldownRef.current = setTimeout(() => {
              console.log('Error cooldown complete, ready for next recognition');
              setRecognitionState('idle');
              startListening(false); // Restart without visual feedback
            }, 2000); // Shorter delay after errors for better responsiveness
          }
        };
        
        recognitionRef.current.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
          
          // Clear timeout when recognition ends
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          // Only restart if we're not already in processing or cooldown
          if (recognitionState !== 'processing' && recognitionState !== 'cooldown') {
            if (alwaysListening && isEnabled && permissionStatus === 'granted') {
              console.log('Setting cooldown after end before next recognition');
              setRecognitionState('cooldown');
              
              if (cooldownRef.current) {
                clearTimeout(cooldownRef.current);
              }
              
              cooldownRef.current = setTimeout(() => {
                console.log('End cooldown complete, ready for next recognition');
                setRecognitionState('idle');
                startListening(false); // Restart without visual feedback
              }, 1000); // Shorter delay for better responsiveness
            } else {
              setRecognitionState('idle');
            }
          }
        };
        
        // Try to check microphone permission status
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
          navigator.permissions.query({ name: 'microphone' as PermissionName })
            .then(status => {
              setPermissionStatus(status.state as 'granted' | 'denied' | 'prompt');
              
              // Start listening automatically if permission is granted
              if (status.state === 'granted' && alwaysListening && isEnabled) {
                setRecognitionState('idle');
                startListening(false);
              }
              
              // Listen for permission changes
              status.addEventListener('change', () => {
                setPermissionStatus(status.state as 'granted' | 'denied' | 'prompt');
                
                // Start listening if permission becomes granted
                if (status.state === 'granted' && alwaysListening && isEnabled) {
                  setRecognitionState('idle');
                  startListening(false);
                }
              });
            })
            .catch(err => {
              console.log('Could not query permission status:', err);
            });
        }
      } else {
        setPermissionStatus('unsupported');
        console.warn('Speech Recognition not supported in this browser');
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (err) {
          console.log('Error aborting speech recognition:', err);
        }
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (cooldownRef.current) {
        clearTimeout(cooldownRef.current);
      }
      if (visualFeedbackTimeoutRef.current) {
        clearTimeout(visualFeedbackTimeoutRef.current);
      }
      if (coordinateTimeoutRef.current) {
        clearTimeout(coordinateTimeoutRef.current);
      }
    };
  }, [onError, onResult, isEnabled, alwaysListening, language, inputMode, partialCoordinate]);
  
  // Start voice recognition
  const startListening = (showFeedback = true) => {
    if (!recognitionRef.current) {
      onError('Speech recognition not supported in this browser');
      return;
    }
    
    if (permissionStatus === 'denied') {
      onError('Microphone access denied. Please enable microphone permissions and try again.');
      return;
    }
    
    if (!isEnabled) {
      return;
    }
    
    // Don't start if already listening or in cooldown
    if (isListening || recognitionState === 'listening' || recognitionState === 'processing' || recognitionState === 'cooldown') {
      console.log(`Ignoring start request, currently in state: ${recognitionState}`);
      return;
    }
    
    console.log('Starting speech recognition');
    
    // Reset any previous error messages
    if (!alwaysListening) {
      onError('');
    }
    
    setIsListening(true);
    setRecognitionState('listening');
    
    // Only show visual feedback when manually activated or when explicitly requested
    if (showFeedback) {
      setShowVisualFeedback(true);
    }
    
    try {
      // Stop any existing session first
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors from stopping
          console.log('Error stopping previous recognition:', e);
        }
      }
      
      // Wait a short moment before starting new recognition
      setTimeout(() => {
        try {
          if (recognitionRef.current) {
            // Update language before starting
            recognitionRef.current.lang = language;
            
            // This will trigger the browser's permission request for the microphone
            recognitionRef.current.start();
            console.log('Recognition started successfully');
            
            // Add a timeout in case something goes wrong (only for manual mode)
            if (!alwaysListening && timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              
              timeoutRef.current = setTimeout(() => {
                if (isListening) {
                  console.log('Recognition timed out');
                  onError('Listening timed out. Please try again.');
                  setIsListening(false);
                  setRecognitionState('idle');
                  setShowVisualFeedback(false);
                  
                  if (recognitionRef.current) {
                    try {
                      recognitionRef.current.stop();
                    } catch (e) {
                      // Ignore errors from stopping
                    }
                  }
                }
              }, 8000);
            }
          } else {
            console.error('Recognition ref is null when trying to start');
            setIsListening(false);
            setRecognitionState('idle');
            setShowVisualFeedback(false);
          }
        } catch (error) {
          console.error('Error starting speech recognition:', error);
          setIsListening(false);
          setRecognitionState('idle');
          setShowVisualFeedback(false);
        }
      }, 200); // Slightly longer delay before starting
    } catch (error) {
      console.error('Speech recognition error:', error);
      onError(`Error: ${error}`);
      setIsListening(false);
      setRecognitionState('idle');
      setShowVisualFeedback(false);
    }
  };
  
  // Stop listening
  const stopListening = () => {
    console.log('Stopping speech recognition');
    if (recognitionRef.current && (isListening || recognitionState === 'listening')) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
      setIsListening(false);
      setRecognitionState('idle');
      setShowVisualFeedback(false);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (cooldownRef.current) {
        clearTimeout(cooldownRef.current);
        cooldownRef.current = null;
      }
      
      if (visualFeedbackTimeoutRef.current) {
        clearTimeout(visualFeedbackTimeoutRef.current);
        visualFeedbackTimeoutRef.current = null;
      }
      
      if (coordinateTimeoutRef.current) {
        clearTimeout(coordinateTimeoutRef.current);
        coordinateTimeoutRef.current = null;
      }
    }
    
    // Reset coordinate input state
    setInputMode('column');
    setPartialCoordinate(null);
  };
  
  // Toggle always listening mode
  const toggleAlwaysListening = () => {
    const newValue = !alwaysListening;
    console.log(`Toggling always listening mode to: ${newValue}`);
    setAlwaysListening(newValue);
    
    if (newValue && isEnabled && permissionStatus === 'granted' && recognitionState === 'idle') {
      // Start listening if we're enabling always-on mode
      startListening(false); // Don't show visual feedback for auto mode
    } else if (!newValue) {
      // Stop listening if we're disabling always-on mode
      stopListening();
      
      // Clear any pending cooldowns
      if (cooldownRef.current) {
        clearTimeout(cooldownRef.current);
        cooldownRef.current = null;
      }
      
      if (visualFeedbackTimeoutRef.current) {
        clearTimeout(visualFeedbackTimeoutRef.current);
        visualFeedbackTimeoutRef.current = null;
      }
      
      if (coordinateTimeoutRef.current) {
        clearTimeout(coordinateTimeoutRef.current);
        coordinateTimeoutRef.current = null;
      }
      
      setRecognitionState('idle');
      setShowVisualFeedback(false);
    }
  };
  
  // Reset coordinate input
  const resetCoordinate = () => {
    setInputMode('column');
    setPartialCoordinate(null);
    
    if (coordinateTimeoutRef.current) {
      clearTimeout(coordinateTimeoutRef.current);
      coordinateTimeoutRef.current = null;
    }
    
    onError('Coordinate input reset. Please start with a new column letter.');
  };
  
  if (permissionStatus === 'unsupported') {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-lg">
        Speech recognition is not supported in this browser. Try using Chrome, Edge, or Safari.
      </div>
    );
  }
  
  // Determine the status message and colors based on the recognition state
  const getStatusInfo = () => {
    if (!isEnabled || permissionStatus !== 'granted') {
      return { message: 'Disabled', bgColor: 'bg-gray-400', textColor: 'text-white' };
    }
    
    // Show coordinate input mode
    let statusSuffix = '';
    if (inputMode === 'column') {
      statusSuffix = ' - Say Column (A-J)';
    } else if (inputMode === 'row' && partialCoordinate) {
      statusSuffix = ` - Column ${partialCoordinate}, Say Row (1-10)`;
    }
    
    // In always-listening mode, we simplify the UI display
    if (alwaysListening) {
      // Only show feedback when we have actual feedback to show
      if (showVisualFeedback) {
        if (recognitionState === 'listening') {
          return { message: `Listening${statusSuffix}`, bgColor: 'bg-red-500', textColor: 'text-white' };
        } else if (recognitionState === 'processing') {
          return { message: 'Processing...', bgColor: 'bg-yellow-500', textColor: 'text-white' };
        }
      }
      
      // Default state for always-listening mode is a subtle indicator
      return { message: `Voice Active${statusSuffix}`, bgColor: 'bg-green-600', textColor: 'text-white hover:bg-green-700' };
    }
    
    // In manual mode, show more detailed state information
    switch (recognitionState) {
      case 'listening':
        return { message: `Listening${statusSuffix}`, bgColor: 'bg-red-500', textColor: 'text-white animate-pulse' };
      case 'processing':
        return { message: 'Processing...', bgColor: 'bg-yellow-500', textColor: 'text-white' };
      case 'cooldown':
        return { message: 'Wait...', bgColor: 'bg-orange-400', textColor: 'text-white' };
      default:
        return { message: `Ready${statusSuffix}`, bgColor: 'bg-blue-600', textColor: 'text-white hover:bg-blue-700' };
    }
  };
  
  const statusInfo = getStatusInfo();
  
  return (
    <div className="voice-recognition-container">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => {
            if (recognitionState === 'listening') {
              stopListening();
            } else if (recognitionState === 'idle') {
              startListening(true); // Always show feedback for manual clicks
            }
          }}
          disabled={!isEnabled || permissionStatus !== 'granted' || recognitionState === 'processing' || recognitionState === 'cooldown'}
          className={`px-3 py-2 rounded-full flex items-center transition-colors duration-300 ${
            !isEnabled || permissionStatus !== 'granted' || recognitionState === 'processing' || recognitionState === 'cooldown'
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : statusInfo.bgColor + ' ' + statusInfo.textColor
          }`}
          aria-label="Voice input"
          title={statusInfo.message}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
          {statusInfo.message}
        </button>
        
        {/* Toggle for always listening mode */}
        <div className="flex items-center">
          <button 
            onClick={toggleAlwaysListening}
            disabled={!isEnabled || permissionStatus !== 'granted'}
            className={`flex items-center justify-center p-1 w-10 h-6 rounded-full transition-colors duration-300 ${
              alwaysListening ? 'bg-green-500' : 'bg-gray-300'
            } ${!isEnabled || permissionStatus !== 'granted' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            title={alwaysListening ? "Always Listening - Click to disable" : "Manual Mode - Click to enable always listening"}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
              alwaysListening ? 'translate-x-2' : '-translate-x-2'
            }`}></div>
          </button>
          <span className="ml-1 text-xs text-gray-700">
            {alwaysListening ? 'Always On' : 'Manual'}
          </span>
        </div>
        
        {/* Reset button - only show when in row mode */}
        {inputMode === 'row' && partialCoordinate && (
          <button
            onClick={resetCoordinate}
            className="ml-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded"
            title="Reset coordinate input"
          >
            Reset
          </button>
        )}
      </div>
      
      {/* Only show listening animation when we need visual feedback */}
      {(showVisualFeedback && recognitionState === 'listening') && (
        <div className="mt-2 text-center transition-opacity duration-300">
          <div className="text-sm text-gray-600 mb-1">
            {inputMode === 'column' 
              ? "Say a column letter like 'A' or 'Alpha'" 
              : `Column ${partialCoordinate} selected. Say a row number like '5' or 'five'`
            }
          </div>
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
            <div className="w-2 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
          </div>
        </div>
      )}
      
      {/* Only show cooldown indicator when manually triggering or when processing after recent input */}
      {(showVisualFeedback && recognitionState === 'cooldown') && (
        <div className="mt-2 text-center transition-opacity duration-300">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-orange-400 h-1.5 rounded-full" style={{ 
              width: '100%', 
              transition: 'width 2s linear',
              animation: 'progress-bar 2s linear'
            }}></div>
          </div>
        </div>
      )}
      
      {permissionStatus === 'denied' && (
        <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded">
          Microphone access denied. Please enable microphone permissions in your browser settings.
        </div>
      )}
    </div>
  );
};

export default VoiceRecognition;