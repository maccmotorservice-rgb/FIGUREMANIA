"""Arte abstracto original; herramienta opcional (Pillow), no se ejecuta en la TV."""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter
im=Image.new('RGB',(1152,302))
pix=im.load()
for y in range(302):
    for x in range(1152):
        glow=math.exp(-(((x-850)/410)**2+((y-135)/250)**2))
        pix[x,y]=(int(17+68*glow),int(9+8*glow),int(16+15*glow))
layer=Image.new('RGBA',im.size)
draw=ImageDraw.Draw(layer)
for i in range(15):
    x=690+i*12
    y=-90+i*6
    draw.arc((x,y,x+410,y+440),20,315,fill=(185+i*3,34+i*3,65+i*3,130),width=4)
draw.ellipse((806,63,969,226),fill=(18,10,18,255),outline=(194,67,89,255),width=2)
layer=layer.filter(ImageFilter.GaussianBlur(.7))
im=Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')
im.save(str(Path(__file__).resolve().parents[1]/'app/assets/hero.jpg'),quality=88,optimize=True)
