(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../../community/char-format'));else root.NicoCharArt=factory(root.NicoChar);})(typeof globalThis!=='undefined'?globalThis:this,function(F){
  'use strict';
  // Original pixel pieces share a 32×48 anchor. Index 0 is transparent; no external artwork.
  const hair={
    curto:[[7,4,18,5],[6,7,4,7]],baguncado:[[6,5,20,5],[8,2,4,5],[15,1,4,6],[22,3,5,6]],afro:[[4,2,24,13],[2,5,28,6]],moicano:[[13,0,6,10],[11,3,10,4]],capacete:[[5,3,22,14],[8,1,16,3]],capuz:[[4,2,24,20],[2,7,4,13],[26,7,4,13]],careca:[],antena:[[14,0,3,6],[11,0,9,2]],crt:[[3,3,26,20],[7,0,3,5],[22,0,3,5]],franja:[[6,3,20,7],[7,8,9,7]],longo:[[5,3,22,9],[4,8,5,23],[24,8,5,23]],coque:[[6,5,21,6],[12,0,10,6]],'rabo-de-cavalo':[[6,4,21,7],[26,6,5,15]],trancas:[[6,4,20,7],[4,11,4,22],[25,11,4,22]],cacheado:[[5,4,23,8],[4,7,5,9],[11,2,5,5],[20,2,5,5]],sidecut:[[13,4,14,7],[21,8,6,8]],espigado:[[5,5,22,6],[5,1,4,6],[12,0,4,6],[19,1,4,6],[25,3,4,5]],bone:[[5,4,22,7],[3,9,28,3]],'cat-ears':[[4,1,7,10],[22,1,7,10],[6,6,20,4]],disco:[[7,0,18,3],[3,4,26,17],[7,21,18,3]],ninja:[[5,4,22,8],[0,8,8,4],[0,11,4,8]],raposa:[[3,0,8,11],[22,0,8,11],[7,6,18,5]]
  };
  const pets={
    'gato-nico':['11000011','12100121','12211221','12222221','12022021','12211221','01222210','00100100'],
    'robo-mini':['00011000','01111110','12222221','12022021','12211221','01111110','01011010','01000010'],
    disquete:['11111111','12200221','12200221','12222221','12111121','12122121','12122121','11111111'],
    morcego:['10000001','11011011','12122121','12222221','01222210','00122100','00011000','00000000'],
    slime:['00011000','00122100','01222210','12222221','12022021','12211221','12222221','01111110'],
    'disco-vivo':['00111100','01222210','12222221','12211221','12211221','12022021','01222210','00111100'],
    fantasma:['00111100','01222210','12222221','12022021','12222221','12211221','12222221','11011011'],
    speaker:['11111111','14444441','14111141','14122141','14122141','14111141','14444441','11111111']
  };
  const emotes={hello:['20002','20002','20202','02220','00200'],fire:['00200','02200','02420','24442','02420'],nota:['00222','00202','00200','22200','22000'],skull:['02220','20202','22222','02220','02020'],coracao:['02020','22222','22222','02220','00200'],raio:['00220','02200','22222','00220','02200'],code:['02020','20002','20002','02020','00000'],glitch:['22422','02020','22242','00200','24222'],fantasma:['02220','22222','20202','22222','20202'],disquete:['22222','20202','22222','20002','22222']};
  function pixels(d,frame=0,{scene=true,portrait=false}={}){
    portrait=portrait||d.mode==='retrato';
    const a=new Uint8Array(64*64);
    const rect=(x,y,w,h,c)=>{for(let yy=Math.max(0,Math.floor(y));yy<Math.min(64,y+h);yy++)for(let xx=Math.max(0,Math.floor(x));xx<Math.min(64,x+w);xx++)a[yy*64+xx]=c;};
    const line=(x,y,x2,y2,c)=>{let dx=Math.abs(x2-x),sx=x<x2?1:-1,dy=-Math.abs(y2-y),sy=y<y2?1:-1,e=dx+dy;for(let n=0;n<150;n++){rect(x,y,1,1,c);if(x===x2&&y===y2)break;let e2=2*e;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}};
    const pattern=(rows,x,y,cmap={1:1,2:2,4:4})=>rows.forEach((row,yy)=>[...row].forEach((p,xx)=>{if(p!=='0')rect(x+xx,y+yy,1,1,cmap[p]||2);}));
    const box=(x,y,w,h,c=3)=>{rect(x,y,w,h,c);rect(x+1,y+1,w-2,h-2,1);};
    const border=(c)=>{rect(0,0,64,1,c);rect(0,63,64,1,c);rect(0,0,1,64,c);rect(63,0,1,64,c);};
    const bg=portrait?'preto':d.scene,mini=!portrait;
    if(scene){
      rect(0,0,64,64,1);
      if(['crt','dev-mode','community-mode'].includes(bg)){for(let p=0;p<64;p+=8){rect(p,0,1,64,5);rect(0,p,64,1,5);}}
      if(bg==='estrelas'||bg==='cidade'||bg==='dungeon'){for(let i=0;i<20;i++)rect((i*23+7)%62,(i*13+3)%44,1,1,i%3===0?4:3);}
      if(bg==='terminal'||bg==='dev-mode'||bg==='boot'){box(4,4,56,30,4);for(let i=0;i<4;i++){rect(8,9+i*5,3+i*5,1,3);rect(8,10+i*5,2,1,4);}rect(9,29,5,2,4);}
      if(bg==='boot'){box(8,13,48,14,3);rect(11,16,42,2,4);rect(11,21,25,2,3);rect(8,31,4,2,2);}
      if(bg==='community-mode'){for(let i=0;i<3;i++){box(5+i*19,8,14,14,3);rect(10+i*19,11,4,4,4);rect(8+i*19,16,8,3,3);}rect(8,25,48,1,4);}
      if(bg==='cidade'){for(let i=0;i<6;i++){const y=13+(i*7)%18;rect(i*12,y,10,51-y,5);for(let n=0;n<5;n++){rect(i*12+2,y+4+n*5,2,1,4);rect(i*12+6,y+4+n*5,2,1,3);}}rect(0,52,64,1,3);}
      if(bg==='dungeon'){for(let y=4;y<50;y+=9)for(let x=-8;x<64;x+=16)box(x+(y%2)*8,y,16,9,5);rect(0,54,64,2,3);}
      if(['estudio','quarto','mixmaster','voz','guitarra'].includes(bg)&&mini){
        const s=d.studio;rect(0,49,64,1,3);for(let i=2;i<64;i+=12)line(i,50,i+8,63,5);
        if(s.poster){box(4,7,12,16);line(6,18,13,10,4);rect(7,20,6,1,2);}
        if(s.lights)for(let i=3;i<62;i+=6)rect(i,3,2,1,i%2?3:4);
        if(s.speakers){box(3,36,10,16);box(51,36,10,16);rect(6,40,4,4,3);rect(54,40,4,4,4);rect(6,47,4,3,3);rect(54,47,4,3,3);}
        if(s.desk){rect(17,37,30,2,3);rect(18,39,2,12,5);rect(44,39,2,12,5);}
        if(s.pc){box(32,24,14,11,3);rect(34,26,10,6,4);rect(38,35,3,2,3);}
        if(s.guitar){rect(7,24,5,9,4);rect(8,16,2,11,3);rect(7,15,4,2,2);}
      }
      if(bg==='palco'){rect(0,51,64,5,3);for(const x of [5,50]){rect(x,4,8,3,3);for(let i=0;i<28;i++)rect(x+2-i/7,8+i,4+i/3,1,5);}rect(3,47,8,4,1);rect(53,47,8,4,1);}
      if(bg==='quarto'){rect(45,32,15,12,3);rect(46,29,13,5,5);rect(48,29,7,3,2);rect(46,34,13,7,5);rect(45,44,2,6,3);rect(59,44,2,6,3);}
      if(bg==='guitarra'){box(48,19,13,16,3);rect(50,22,9,1,4);rect(51,26,7,6,5);rect(53,27,3,4,3);}
      if(bg==='mixmaster'){box(5,24,16,10,3);for(let i=0;i<5;i++){rect(8+i*2,27,1,5,2);rect(7+i*2,28+i%3,3,1,4);}}
      if(bg==='halloween'){pattern(['0022200','0224220','2422242','2222222','0222220'],3,42);rect(58,8,2,16,4);rect(54,12,10,1,4);}
      if(bg==='natal'){for(let y=0;y<26;y++)rect(52-y/4,12+y,y/2+1,1,4);rect(51,38,3,8,3);}
      if(bg==='aniversario'){rect(4,40,12,10,4);rect(4,43,12,2,2);for(let x=6;x<15;x+=3){rect(x,36,1,4,3);rect(x,34,1,2,4);}}
      if(bg==='desafio'){box(48,8,11,13,4);rect(52,21,3,4,3);rect(49,25,9,2,4);}
      if(bg==='voz'){rect(55,14,4,8,4);rect(56,22,2,15,3);}
    }
    if(d.effect!=='nenhum'&&scene){
      if(['brilho','contorno'].includes(d.effect)){box(13,6,38,49,frame%2?4:5);}
      if(d.effect==='scanline')rect(3,8+frame*11,58,1,5);
      if(d.effect==='glitch'&&frame===2){rect(8+frame*3,20+frame*6,7,1,4);rect(46,36-frame*3,5,1,3);}
      if(['fumaca','poeira','notas','raios','orbita'].includes(d.effect))for(let i=0;i<5;i++){const x=8+(i*13+frame*5)%49,y=6+(i*11-frame*3+64)%45;rect(x,y,2,2,i%2?3:4);if(d.effect==='notas')rect(x+2,y-3,1,4,4);if(d.effect==='raios')line(x,y,x+3,y+5,4);}
      if(d.effect==='brilho'){for(const [x,y]of [[10,17],[51,33],[11,46]]){rect(x-2,y,5,1,4);rect(x,y-2,1,5,4);}}
      if(d.effect==='fumaca'){for(let i=0;i<4;i++){rect(9+i*12,47-frame*2-i%2,7,2,5);rect(12+i*12,44-frame*2-i%2,5,2,3);}}
      if(d.effect==='orbita'){const positions=[[4,25],[44,7],[50,44],[14,51]];const [x,y]=positions[frame%4];pattern(pets['disco-vivo'],x,y);}
    }
    const bounce=frame===2&&d.animation?1:0,ox=16,oy=7-bounce;
    const r=(x,y,w,h,c)=>rect(ox+x,oy+y,w,h,c);
    if(d.drawing){
      const g=d.drawing,s=g.size===16?2:1;for(let i=0;i<g.pixels.length;i++){const c=Number(g.pixels[i]);if(c)r((i%g.size)*s,Math.floor(i/g.size)*s+8,s,s,c);}
    }else if(d.style==='atari-minimal'){
      const robots=[['000111111000','001222222100','012022022210','012222222210','001111111100','011244442110','122244442221','100111111001','000122221000','000120021000','001110011100'],['000011110000','000122221000','001202202100','001222222100','000111111000','011244442110','122244442221','100111111001','000120021000','001120021100','001110011100']];
      const p=robots[frame%2];p.forEach((row,y)=>[...row].forEach((v,x)=>{if(v!=='0')r(4+x*2,12+y*2,2,2,Number(v));}));
    }else{
      const small=['baixinho','chibi'].includes(d.body),wide=['chibi','robo'].includes(d.body),legY=small?32:35,legH=small?7:d.body==='alto'?12:10;
      const seated=['sentado','synth'].includes(d.pose),jump=d.pose==='pulando'?-3:0;
      const ry=(x,y,w,h,c)=>r(x,y+jump,w,h,c);
      // Back layer: hood and hair, then skin and the shared body anchors.
      for(const [x,y,w,h]of hair[d.hair]||[])ry(x,y,w,h,d.hair==='careca'?2:3);
      ry(7,7,18,15,1);ry(8,8,16,13,2);ry(10,22,12,3,3);
      if(d.body==='criatura'){ry(4,4,6,10,3);ry(23,4,6,10,3);ry(12,16,9,5,3);ry(14,17,5,2,1);}
      const left=wide?6:d.body==='magro'?10:8,width=wide?20:d.body==='magro'?12:16;
      ry(left,25,width,legY-23,1);ry(left+1,26,width-2,legY-25,4);
      ry(8,legY,7,seated?5:legH,3);ry(18,legY,7,seated?5:legH,3);
      const step=d.pose==='andando'&&frame%2?2:0;ry(seated?4:7,legY+(seated?4:legH)+step,9,2,2);ry(seated?23:18,legY+(seated?4:legH)-step,9,2,2);
      const c=d.clothing;
      if(['hoodie','college','jaqueta','colete','jardineira'].includes(c)){ry(15,26,2,11,1);ry(10,30,3,2,3);ry(20,30,3,2,2);}
      if(['armadura-synth','astronauta','cassete'].includes(c)){ry(10,26,13,8,3);ry(12,28,9,3,1);ry(14,29,5,1,4);}
      if(['sobretudo','capa','mago','kimono','vestido','ninja'].includes(c)){ry(left-2,25,3,17,3);ry(left+width-1,25,3,17,3);ry(10,35,14,4,4);ry(10,29,14,2,1);}
      if(c==='camiseta'){ry(12,25,8,2,2);ry(14,30,5,4,2);}
      if(c==='street'){ry(6,25,20,3,3);ry(6,28,3,9,4);ry(24,28,3,9,4);ry(11,32,12,2,1);}
      if(c==='dj'){ry(8,26,4,11,2);ry(20,26,4,11,2);ry(14,30,4,4,1);}
      if(c==='dev'){ry(10,29,3,3,1);ry(14,30,4,1,2);ry(19,29,3,3,1);}
      if(c==='equalizador'){for(let i=0;i<5;i++)ry(10+i*3,32-(i+frame)%4,2,2+(i+frame)%4,2);}
      if(c==='disco'){ry(11,28,11,7,2);ry(14,29,5,5,3);ry(15,30,3,3,1);}
      if(c==='listras')for(let y=27;y<35;y+=3)ry(9,y,14,1,2);
      if(c==='punk'){ry(8,25,5,2,2);ry(21,25,5,2,2);ry(10,30,13,1,1);ry(12,28,1,7,2);}
      if(c==='hoodie'){ry(12,26,1,4,2);ry(20,26,1,4,2);ry(11,33,11,2,3);}
      if(c==='college'){ry(7,26,3,9,2);ry(23,26,3,9,2);ry(11,28,3,5,2);ry(14,31,3,2,2);}
      if(c==='jaqueta'){for(let i=0;i<5;i++){ry(9+i,26+i,2,1,3);ry(22-i,26+i,2,1,3);}ry(15,27,1,10,2);}
      if(c==='colete'){ry(8,26,5,11,3);ry(20,26,5,11,3);ry(10,28,2,2,2);ry(21,28,2,2,2);}
      if(c==='jardineira'){ry(11,25,2,8,3);ry(20,25,2,8,3);ry(11,31,11,5,3);ry(13,33,7,2,1);}
      if(c==='sobretudo'){for(let y=27;y<39;y+=4)ry(16,y,1,1,2);ry(9,24,4,5,1);ry(21,24,4,5,1);}
      if(c==='capa'){ry(5,25,4,18,1);ry(24,25,4,18,1);ry(10,24,13,2,2);ry(15,26,3,2,2);}
      if(c==='mago'){ry(14,26,5,1,2);ry(16,24,1,5,2);ry(12,32,1,1,2);ry(21,34,1,1,2);ry(8,39,18,2,2);}
      if(c==='kimono'){for(let i=0;i<9;i++)ry(10+i,25+i,2,1,2);ry(9,34,16,2,1);ry(20,35,2,5,3);}
      if(c==='vestido'){for(let y=35;y<42;y++)ry(11-(y-35)/2,y,12+y-35,1,4);ry(9,40,16,1,2);}
      if(c==='ninja'){ry(8,25,17,2,1);ry(9,33,15,3,1);ry(21,35,2,7,4);ry(12,29,8,1,2);}
      if(c==='astronauta'){ry(8,24,4,5,2);ry(21,24,4,5,2);ry(12,28,3,2,4);ry(19,28,2,2,1);ry(15,32,3,5,2);}
      if(c==='cassete'){ry(10,27,13,8,1);ry(11,28,4,4,2);ry(18,28,4,4,2);ry(13,29,1,2,3);ry(19,29,1,2,3);ry(14,34,5,1,3);}
      let ly=27,lh=9,rx=25,rry=27,rh=9;
      if(d.pose==='peace'||d.pose==='boss-fight'){rry=17;rh=15;}
      if(d.pose==='pulando'){ly=17;lh=15;rry=17;rh=15;}
      if(d.pose==='bracos-cruzados'){ry(8,31,18,3,2);lh=5;rh=5;}
      else{ry(4,ly,4,lh,3);ry(rx,rry,4,rh,3);ry(4,ly+lh-1,4,3,2);ry(rx,rry+rh-1,4,3,2);}
      if(d.pose==='peace'){ry(25,15,1,5,2);ry(28,15,1,5,2);}
      if(d.pose==='mao-no-bolso')ry(23,31,4,4,1);
      if(d.body==='robo'){ry(4,30,4,2,1);ry(25,30,4,2,1);ry(10,38,3,2,1);ry(20,38,3,2,1);ry(12,24,9,2,1);}
      if(d.pose==='costas'){ry(8,8,16,13,3);ry(10,25,12,11,3);ry(12,27,8,7,1);}
      else{
        const blink=frame===3&&d.animation,eyes=d.eyes;
        const ey=d.pose==='perfil'?15:12,x1=d.pose==='perfil'?20:11,x2=d.pose==='perfil'?23:20;
        if(eyes==='visor'||d.hair==='crt'){ry(7,8,18,12,1);ry(9,10,14,8,5);}
        if(eyes==='feliz'||eyes==='animado'){ry(x1,ey,3,1,1);ry(x2,ey,3,1,1);ry(x1,ey+1,1,1,1);ry(x2+2,ey+1,1,1,1);}
        else{ry(x1,ey,blink?3:2,blink||eyes==='sono'?1:4,eyes==='glitch'&&frame%2?4:eyes==='visor'||d.hair==='crt'?4:1);ry(x2,ey,blink?3:2,blink||eyes==='sono'?1:4,eyes==='visor'||d.hair==='crt'?4:1);}
        if(['serio','raiva'].includes(eyes)){ry(10,10,4,1,1);ry(20,10,4,1,1);}
        if(eyes==='raiva'){ry(11,10,2,2,1);ry(13,11,2,2,1);ry(19,11,2,2,1);ry(21,10,2,2,1);}
        if(eyes==='animado'&&!blink){ry(10,11,5,5,1);ry(19,11,5,5,1);ry(11,11,2,2,2);ry(20,11,2,2,2);}
        if(eyes==='emoji'){ry(11,12,3,3,4);ry(19,12,3,3,4);}
        const face=d.face;if(face==='sorriso'||face==='dentes'){ry(13,18,7,2,1);if(face==='dentes')ry(14,18,5,1,2);}
        if(face==='mascara'){ry(8,16,16,5,3);ry(11,17,10,1,1);}
        if(face==='barba'){ry(8,18,16,4,3);ry(11,22,10,1,3);}
        if(face==='bigode')ry(11,17,11,2,1);
        if(face==='blush'){ry(9,17,3,1,4);ry(21,17,3,1,4);}
        if(face==='cicatriz'){ry(23,10,1,8,3);ry(22,12,3,1,1);}
      }
      // Front rim keeps heads recognizable without hiding eyes.
      if(['curto','franja','baguncado','bone','ninja','capuz'].includes(d.hair))ry(7,6,18,3,d.hair==='capuz'?1:3);
      const item=d.pose==='guitarra'?'guitarra':d.pose==='microfone'?'microfone':d.pose==='sentado'?'laptop':d.pose==='synth'?'sintetizador':d.accessory;
      if(['fones','fone-raro','headset'].includes(item)){ry(5,6,22,2,1);ry(4,8,4,11,item==='fone-raro'?4:3);ry(25,8,4,11,item==='fone-raro'?4:3);if(item==='headset'){ry(24,18,5,2,1);ry(21,19,5,1,4);}}
      if(['oculos','oculos-escuros'].includes(item)){ry(8,11,8,5,1);ry(18,11,8,5,1);ry(16,12,2,1,1);if(item==='oculos'){ry(10,12,4,2,3);ry(20,12,4,2,3);}}
      if(item==='corrente'){ry(10,25,1,5,2);ry(22,25,1,5,2);ry(11,30,12,1,2);}
      if(item==='mochila'){ry(25,25,6,11,3);ry(26,27,4,5,4);}
      if(item==='luvas'){ry(4,33,4,5,4);ry(25,33,4,5,4);}
      if(item==='bone'){ry(7,4,18,4,4);ry(5,8,24,2,3);}
      if(item==='guitarra'){ry(9,29,10,11,1);ry(10,30,8,9,4);ry(13,32,3,3,1);for(let i=0;i<15;i++)ry(17+i/2,31-i,3,1,3);ry(24,16,4,4,2);if(frame%2)ry(19,28,5,2,2);}
      if(item==='microfone'){ry(26,22,5,8,1);ry(27,23,3,5,3);ry(28,30,1,13,3);ry(24,43,8,1,3);}
      if(['laptop','sampler','sintetizador'].includes(item)){ry(4,30,25,item==='laptop'?10:7,1);ry(6,31,21,6,3);if(item==='laptop'){ry(7,32,19,4,5);ry(4,40,26,2,3);}else for(let i=0;i<7;i++){ry(7+i*3,32,2,4,i%2?2:4);}}
      if(item==='sampler'){ry(5,31,23,6,1);for(let x=7;x<27;x+=4)for(let y=32;y<37;y+=3)ry(x,y,2,2,x%3?4:2);}
      if(item==='laptop'&&frame%2){ry(9,38,4,2,2);ry(22,39,4,2,2);}
      if(item==='camera'){ry(24,30,7,6,1);ry(26,31,3,3,3);ry(24,29,3,1,2);}
      if(item==='espada'||item==='cajado'){ry(29,13,2,26,3);ry(25,31,9,2,4);if(item==='cajado'){ry(27,8,6,6,4);ry(29,10,2,2,2);}}
      if(item==='cd'||item==='disquete'){pattern(item==='cd'?pets['disco-vivo']:pets.disquete,ox+26,oy+25+(frame%2));}
      if(item==='cd'){ry(29+frame%2,26+frame%2,1,2,4);}
      if(item==='boombox'){ry(3,31,27,10,1);ry(5,33,6,6,3);ry(22,33,6,6,3);ry(13,33,7,3,4);ry(7,29,17,2,3);}
      if(item==='skate'){ry(2,46,30,2,4);ry(7,48,3,2,3);ry(24,48,3,2,3);}
      if(item==='capa-evento'){ry(1,24,4,19,4);ry(28,24,4,19,4);}
    }
    if(d.companion!=='nenhum'&&scene&&!portrait){
      const pos={lado:[48,44],ombro:[41,21],flutuando:[46,13],rodape:[26+frame,53]};let [x,y]=pos[d.companionPosition]||pos.lado;
      if(bg==='quarto'){x=d.studio.petX;y=d.studio.petY;}
      pattern(pets[d.companion]||pets['gato-nico'],x,y-(frame===1?1:0));
    }
    if(scene&&d.emote!=='nenhum'&&!portrait){box(44,2,13,11,5);pattern(emotes[d.emote]||emotes.nota,48,5,{2:4,4:2});}
    if(scene){
      const f=d.frame;border(f==='metal'||f==='pixel'?3:4);if(f==='terminal'||f==='save-slot'){rect(1,1,62,3,5);rect(3,2,2,1,4);rect(7,2,2,1,3);}if(['crt','cartucho','cassete'].includes(f)){rect(1,1,3,3,1);rect(60,1,3,3,1);rect(1,60,3,3,1);rect(60,60,3,3,1);}if(f==='cassete'){rect(7,58,12,3,3);rect(45,58,12,3,3);}if(f==='hud'){rect(3,3,8,1,4);rect(3,3,1,8,4);rect(53,60,8,1,4);rect(60,53,1,8,4);}
      if(f==='metal')for(const [x,y]of [[2,2],[59,2],[2,59],[59,59]]){rect(x,y,3,3,3);rect(x+1,y+1,1,1,1);}
      if(f==='crt'){rect(2,5,1,53,5);rect(61,5,1,53,5);rect(5,61,53,1,5);for(let y=6;y<59;y+=4)rect(59,y,1,1,3);}
      if(f==='cartucho'){rect(15,2,34,2,3);for(let x=17;x<48;x+=4)rect(x,60,2,3,3);}
      if(f==='save-slot'){rect(3,6,2,5,4);rect(6,6,3,1,3);rect(8,6,1,5,3);rect(3,12,7,1,5);rect(48,59,11,2,3);}
    }
    return a;
  }
  function paint(canvas,d,frame=0,options={}){
    const p=pixels(d,frame,options),ctx=canvas.getContext('2d'),data=ctx.createImageData(64,64),colors=['#000000',...F.colors[d.palette]];
    for(let i=0;i<p.length;i++){if(!p[i])continue;const hex=colors[p[i]]||'#ffffff';data.data[i*4]=parseInt(hex.slice(1,3),16);data.data[i*4+1]=parseInt(hex.slice(3,5),16);data.data[i*4+2]=parseInt(hex.slice(5,7),16);data.data[i*4+3]=255;}
    const scratch=canvas.ownerDocument.createElement('canvas');scratch.width=64;scratch.height=64;scratch.getContext('2d').putImageData(data,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(scratch,0,0,canvas.width,canvas.height);
  }
  // GIF clear codes keep each pixel independent: bounded files, no compressor dependency.
  function gif(d,{size=128,scene=false}={}){
    if(![64,128,256].includes(size))throw Error('Tamanho inválido.');
    const out=[],push=(...x)=>out.push(...x),word=n=>push(n&255,n>>8),ascii=s=>push(...[...s].map(c=>c.charCodeAt(0)));
    ascii('GIF89a');word(size);word(size);push(0xf2,0,0);
    for(const color of ['#000000',...F.colors[d.palette],'#000000','#000000'])push(parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16));
    push(0x21,0xff,11);ascii('NETSCAPE2.0');push(3,1,0,0,0);
    for(let frame=0;frame<(d.animation?4:1);frame++){
      push(0x21,0xf9,4,9);word(frame===0?65:18);push(0,0,0x2c);word(0);word(0);word(size);word(size);push(0,3);
      const p=pixels(d,frame,{scene}),bytes=[];let bits=0,n=0;const code=c=>{bits|=c<<n;n+=4;if(n>=8){bytes.push(bits&255);bits>>=8;n-=8;}};
      code(8);for(let y=0;y<size;y++)for(let x=0;x<size;x++){code(p[Math.floor(y*64/size)*64+Math.floor(x*64/size)]);code(8);}code(9);if(n)bytes.push(bits&255);
      for(let i=0;i<bytes.length;i+=255){const chunk=bytes.slice(i,i+255);push(chunk.length,...chunk);}push(0);
    }push(0x3b);return new Uint8Array(out);
  }
  return {pixels,paint,gif};
});
