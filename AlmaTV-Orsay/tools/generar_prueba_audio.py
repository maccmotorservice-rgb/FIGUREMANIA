"""Genera la muestra original. Solo desarrollo: requiere FFmpeg, no la TV ni el instalador."""
import math
from pathlib import Path
import struct
import subprocess
import tempfile
import wave
RATE=22050
NOTES=[261.63,329.63,392.0,523.25,440.0,392.0,329.63,293.66]
with tempfile.TemporaryDirectory() as directory:
    source=Path(directory)/'prueba.wav'
    with wave.open(str(source),'wb') as output:
        output.setnchannels(1);output.setsampwidth(2);output.setframerate(RATE)
        frames=bytearray()
        for i in range(RATE*12):
            t=i/RATE;n=int(t/1.5);local=t-n*1.5
            envelope=min(1,local/.025)*math.exp(-2.8*local)*max(0,min(1,(12-t)/.3))
            value=.22*envelope*(math.sin(2*math.pi*NOTES[n]*t)+.2*math.sin(4*math.pi*NOTES[n]*t))
            frames.extend(struct.pack('<h',int(value*32767)))
        output.writeframes(frames)
    target=Path(__file__).resolve().parents[1]/'app/assets/media/prueba-sonido.mp3'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-codec:a','libmp3lame','-b:a','64k',str(target)],check=True)
