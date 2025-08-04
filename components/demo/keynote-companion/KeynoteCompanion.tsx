/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState } from 'react';
import { Modality, LiveServerContent } from '@google/genai';
import { jsPDF } from 'jspdf';

import BasicFace from '../basic-face/BasicFace';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { createSystemInstructions } from '@/lib/prompts';
import { useAgent, useUser } from '@/lib/state';

export default function KeynoteCompanion() {
  const { client, connected, setConfig } = useLiveAPIContext();
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const user = useUser();
  const { current } = useAgent();
  const [transcript, setTranscript] = useState<
    { speaker: string; text: string }[]
  >([]);

  // Set the configuration for the Live API
  useEffect(() => {
    setConfig({
      responseModalities: [Modality.AUDIO, Modality.TEXT],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: current.voice },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: createSystemInstructions(current, user),
          },
        ],
      },
    });
  }, [setConfig, user, current]);

  // Initiate the session when the Live API connection is established
  // Instruct the model to send an initial greeting message
  useEffect(() => {
    const beginSession = async () => {
      if (!connected) return;
      const initialText =
        'Greet the user and introduce yourself and your role.';
      setTranscript(prev => [...prev, { speaker: 'user', text: initialText }]);
      client.send({ text: initialText }, true);
    };
    beginSession();
  }, [client, connected]);

  // Capture textual responses from the model for transcription
  useEffect(() => {
    const handleContent = (data: LiveServerContent) => {
      const texts = data.modelTurn?.parts
        ?.map(p => p.text)
        .filter((t): t is string => !!t);
      if (texts?.length) {
        setTranscript(prev => [
          ...prev,
          ...texts.map(t => ({ speaker: 'assistant', text: t })),
        ]);
      }
    };
    client.on('content', handleContent);
    return () => {
      client.off('content', handleContent);
    };
  }, [client]);

  const downloadTranscript = () => {
    const doc = new jsPDF();
    transcript.forEach(({ speaker, text }, idx) => {
      doc.text(`${speaker}: ${text}`, 10, 10 + idx * 10);
    });
    doc.save('transcript.pdf');
  };

  return (
    <div className="keynote-companion">
      <BasicFace canvasRef={faceCanvasRef!} color={current.bodyColor} />
      <div className="transcript">
        {transcript.map((line, idx) => (
          <div key={idx}>
            <strong>{line.speaker}:</strong> {line.text}
          </div>
        ))}
      </div>
      <button onClick={downloadTranscript}>Download PDF</button>
    </div>
  );
}
