import ctypes,ctypes.util,subprocess,time,json,math,array
from pathlib import Path
out=Path('/tmp/alma-volume-proof');out.mkdir(exist_ok=True)
library=ctypes.util.find_library('zmq')
if not library:raise SystemExit('La prueba requiere libzmq y un FFmpeg que incluya azmq.')
lib=ctypes.CDLL(library)
lib.zmq_ctx_new.restype=ctypes.c_void_p
lib.zmq_socket.argtypes=[ctypes.c_void_p,ctypes.c_int];lib.zmq_socket.restype=ctypes.c_void_p
lib.zmq_connect.argtypes=[ctypes.c_void_p,ctypes.c_char_p]
lib.zmq_setsockopt.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_void_p,ctypes.c_size_t]
lib.zmq_send.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_size_t,ctypes.c_int]
lib.zmq_recv.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_size_t,ctypes.c_int]
lib.zmq_close.argtypes=[ctypes.c_void_p];lib.zmq_ctx_term.argtypes=[ctypes.c_void_p]
ctx=lib.zmq_ctx_new();sock=lib.zmq_socket(ctx,3);timeout=ctypes.c_int(3000)
for opt in [27,28]:lib.zmq_setsockopt(sock,opt,ctypes.byref(timeout),ctypes.sizeof(timeout))
lib.zmq_connect(sock,b'tcp://127.0.0.1:5555')
cmd=['ffmpeg','-nostdin','-y','-v','error','-re','-stream_loop','-1','-i','tests/fixtures/video-prueba.mp4','-re','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','8','-map','0:v:0','-map','1:a:0','-c:v','copy','-af','volume@alma=1,azmq','-c:a','aac','-b:a','128k','-hls_time','1','-hls_list_size','0','-hls_segment_filename',str(out/'segment-%03d.ts'),'-f','hls',str(out/'index.m3u8')]
log=(out/'ffmpeg.log').open('wb');process=subprocess.Popen(cmd,stdout=subprocess.DEVNULL,stderr=log);start=time.monotonic();events=[]
try:
 for at,level in [(2,0.25),(4,0),(6,1)]:
  while time.monotonic()-start<at:time.sleep(.05)
  message=('volume@alma volume '+str(level)).encode();assert lib.zmq_send(sock,message,len(message),0)>=0
  reply=ctypes.create_string_buffer(512);size=lib.zmq_recv(sock,reply,512,0);assert size>=0, 'Sin respuesta ZMQ'
  response=reply.raw[:size].decode();assert response.startswith('0 '),response
  events.append({'at':round(time.monotonic()-start,2),'level':level,'response':response,'same_process':process.poll() is None})
 assert process.wait(timeout=15)==0
finally:
 if process.poll() is None:process.kill();process.wait()
 lib.zmq_close(sock);lib.zmq_ctx_term(ctx);log.close()
subprocess.run(['ffmpeg','-v','error','-y','-i',str(out/'index.m3u8'),'-vn','-ac','1','-ar','48000','-f','s16le',str(out/'audio.pcm')],check=True)
samples=array.array('h');samples.frombytes((out/'audio.pcm').read_bytes())
levels=[]
for a,b in [(0.7,1.5),(2.7,3.5),(4.7,5.5),(6.7,7.5)]:
 part=samples[int(a*48000):int(b*48000)];rms=math.sqrt(sum(float(x)*x for x in part)/len(part));levels.append(round(20*math.log10(max(rms,1e-10)/32768),2))
assert abs((levels[1]-levels[0])+12.04)<1.5,levels
assert levels[2]<-60,levels
assert abs(levels[3]-levels[0])<1.5,levels
result={'events':events,'rms_dbfs_original_quarter_mute_restored':levels,'video':'h264 copy, sin recodificar','hls_segments':len(list(out.glob('*.ts'))),'scope':'Prueba local Linux con video fixture y tono sintetico; no TV ni Mac fisica'}
(out/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
