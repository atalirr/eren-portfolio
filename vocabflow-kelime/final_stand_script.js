// Stand tasarımı - Atlı Medikal Resmi Masaüstü QR Standı
const oldNodes = figma.currentPage.findAll(n => n.name && n.name.startsWith('QR Stand'));
for (const n of oldNodes) n.remove();

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

// Ana Stand Frame - 560 x 300
const stand = figma.createFrame();
stand.name = 'QR Stand - Atlı Medikal';
stand.resize(560, 300);
stand.x = 100;
stand.y = 100;
stand.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
stand.cornerRadius = 8;
stand.clipsContent = true;
stand.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.90, b: 0.94 } }];
stand.strokeWeight = 1;
stand.effects = [
  {
    type: 'DROP_SHADOW',
    color: { r: 0.06, g: 0.09, b: 0.16, a: 0.07 },
    offset: { x: 0, y: 3 },
    radius: 12,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL'
  }
];

// Üstte 3px kurumsal lacivert çizgi
const topBar = figma.createRectangle();
topBar.name = 'Top Accent';
topBar.resize(560, 3);
topBar.x = 0;
topBar.y = 0;
topBar.fills = [{ type: 'SOLID', color: { r: 0.06, g: 0.09, b: 0.16 } }];
stand.appendChild(topBar);

// ---- 1. KÜÇÜLTÜLMÜŞ ÜST KISIM (BAŞLIK METİNLERİ KALDIRILDI) ----
const header = figma.createFrame();
header.name = 'Header - Logo & Marka';
header.resize(560, 42);
header.x = 0;
header.y = 3;
header.fills = [];
stand.appendChild(header);

// Logo SVG Monogram
const logoNode = figma.createNodeFromSvg(`<svg width="40" height="40" viewBox="457 157 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M502 162.143L462.714 240.714H482.357L502 199.643L521.643 240.714H541.286L502 162.143Z" fill="#0F172A"/>
<path opacity="0.18" d="M502 185.357L512.714 210.357H491.286L502 185.357Z" fill="#0F172A"/>
<path d="M502 215.714L509.143 230H494.857L502 215.714Z" fill="#0F172A"/>
</svg>`);
logoNode.name = 'Logo Monogram';
logoNode.resize(22, 22);
logoNode.x = 34;
logoNode.y = 10;
header.appendChild(logoNode);

// "ATLI MEDİKAL"
const brand = figma.createText();
brand.name = 'Brand Name';
brand.characters = 'ATLI MEDİKAL';
brand.fontSize = 13;
brand.fontName = { family: 'Inter', style: 'Bold' };
brand.fills = [{ type: 'SOLID', color: { r: 0.06, g: 0.09, b: 0.16 } }];
brand.letterSpacing = { value: 1.2, unit: 'PIXELS' };
brand.x = 64;
brand.y = 14;
header.appendChild(brand);

// "TIBBİ CİHAZ VE SAĞLIK ÜRÜNLERİ"
const subBrand = figma.createText();
subBrand.name = 'Sub Brand';
subBrand.characters = 'TIBBİ CİHAZ VE SAĞLIK ÜRÜNLERİ';
subBrand.fontSize = 8.5;
subBrand.fontName = { family: 'Inter', style: 'Medium' };
subBrand.fills = [{ type: 'SOLID', color: { r: 0.45, g: 0.50, b: 0.58 } }];
subBrand.letterSpacing = { value: 0.8, unit: 'PIXELS' };
subBrand.textAlignHorizontal = 'RIGHT';
subBrand.resize(220, 16);
subBrand.x = 306;
subBrand.y = 16;
header.appendChild(subBrand);

// İnce ayırıcı çizgi
const div1 = figma.createRectangle();
div1.name = 'Header Divider';
div1.resize(500, 1);
div1.x = 30;
div1.y = 45;
div1.fills = [{ type: 'SOLID', color: { r: 0.90, g: 0.92, b: 0.95 } }];
stand.appendChild(div1);

// ---- 2. SOL PANEL: DEĞERLENDİRME ----
const leftBox = figma.createFrame();
leftBox.name = 'Panel - Değerlendirme';
leftBox.resize(236, 214);
leftBox.x = 30;
leftBox.y = 54;
leftBox.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.985, b: 0.995 } }];
leftBox.cornerRadius = 6;
leftBox.strokes = [{ type: 'SOLID', color: { r: 0.89, g: 0.91, b: 0.94 } }];
leftBox.strokeWeight = 1;
stand.appendChild(leftBox);

// "Değerlendirme" Başlığı
const t1 = figma.createText();
t1.name = 'Title - Değerlendirme';
t1.characters = 'Değerlendirme';
t1.fontSize = 15;
t1.fontName = { family: 'Inter', style: 'Bold' };
t1.fills = [{ type: 'SOLID', color: { r: 0.06, g: 0.09, b: 0.16 } }];
t1.textAlignHorizontal = 'CENTER';
t1.resize(236, 20);
t1.x = 0;
t1.y = 12;
leftBox.appendChild(t1);

// 5 Altın Yıldız
const stars = figma.createText();
stars.name = 'Rating Stars';
stars.characters = '★  ★  ★  ★  ★';
stars.fontSize = 12;
stars.fontName = { family: 'Inter', style: 'Regular' };
stars.fills = [{ type: 'SOLID', color: { r: 0.92, g: 0.69, b: 0.13 } }];
stars.textAlignHorizontal = 'CENTER';
stars.resize(236, 16);
stars.x = 0;
stars.y = 33;
leftBox.appendChild(stars);

// QR Kutu 1 - Karttaki Google Review QR
const qrFrame1 = figma.createFrame();
qrFrame1.name = 'QR 1 Frame';
qrFrame1.resize(110, 110);
qrFrame1.x = 63;
qrFrame1.y = 54;
qrFrame1.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
qrFrame1.cornerRadius = 6;
qrFrame1.strokes = [{ type: 'SOLID', color: { r: 0.82, g: 0.85, b: 0.89 } }];
qrFrame1.strokeWeight = 1;

const imgRev = figma.createImage(figma.base64Decode("iVBORw0KGgoAAAANSUhEUgAAAhwAAAIcCAIAAAAynOArAAAMZklEQVR4nO3cwY3jzBVG0WljAuilc3D+oTgHL5UBnQKB/+LhVemcACSKZM9FzeL7eZ7nDwAU/pV8CgCICgAlJxUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBIPO3+qDff//nz7f6/O+/yf158zlvVN81+Uyr377t/kz+rje2vYcnvhu3+kT32UkFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVAPZtf72xbQdp235RtctU3efJfbBtO2Pbdr1u3aQ68d+EE6/5d/D9cVIBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgDO3v07cgKrcut20bWvrzedMftfkDtsb27baJrf1Jv1e+u/YG04qAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAHDv9tetqi2pyjdvkb0xuet1q23bep7XDCcVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMjY/lpkcpuo+q43m0vVLlO1V1Z917a9qck9t23Py67XHk4qAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAHDv9tetGz6T+1fbNsS2bXadaNt+2rb7fOLfxa2cVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQHgzO2vbXtB32zbFtm27aY3bv1dlVu32k685klOKgBkRAWAjKgAkBEVAEQFgH2cVADIiAoAGVEBICMqAGREBYCMqACwb/vr1v2iE+/P5B5XdT3f/B5u2wf75m2rE9+fbZxUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRAWDf9tfk3tSJO0iTv33ymt+49ZlOPq/Jezj5jp24RTb5LH4P/HfVSQWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUA9m1/3erEHaRt1/zGtr2yW217NyavZ9sGXWXb37KTCgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgDcu/21bZto8pqr3aETd7ROfKbf/I6deH9u3db7LLseJxUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAuHf7a3K/aNK2Xa/Ktr2pbe/PrRtQ33yfT3ymn8Fn4aQCQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKAJmf53mu3MM5cUdrcrtp2y6T6znr7+LE/b1b/x3bxkkFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADJ/t+1WTX7OG9+8SVXZtkl14jOtNqkm37Ftv33yuX+W/Ts2+V1OKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACwb/vrxN2qbfs8b0zuIFXf9cbkZte2Z1o5cVvv1vf5jW33sOKkAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgD7tr8q23aZTtyb2rbZdetuVWXb/lV1f7Zdz63v/GfZ/XFSASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYDMz/M8f06zbSup+q5tu16VbdtE296fE+/P5DVve+dv/e2f6Hc5qQCQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogLAvu2vbRtZt24c3bohtu0+V7bty2177rf6LNuFm/wuJxUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyPz9M+jEfafJXabJ+7Ntm+iNbbtVJz6vyrbnvu16fpe9q5OcVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEg8/M8T/JB27Zutm1bbfuuyq33eXLzbdvvuvX+vLFtQ+yz7P15w0kFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVAPZtf53IXtCee3gre1wz92ebz+CG2Bu2vwA4kv/+AiAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGT+Vh/0zfs81a5OdQ9P3DS7dQOqMvnbJ3eiJnnHZjipAJARFQAyogJARlQAyIgKABlRAUBUANjHSQWAjKgAkBEVADKiAsC+7a9v3vk5cVOouuZb99Oq7zpxh+3Ea65Mvs+VbffZSQWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUA9m1/bdu/2rYBVX3Xib992zZRZfJ5bdtG2/bcT/w7vfVv0EkFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADI/z/P8udHkztg3bxNtexbbNugm98FO3I47cctu8rs+tr8A+Gb++wuAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQ+Vt90LYdm8n9qzfXPLndVJm85m07UW+cuMs0eX+2PYtbfZa9h04qAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoALBv+2tyf2ZyU+iNE6952ybVic9i297diZ+zTfW7fpe9Y5OcVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEg8/M8z3EbNTaOvtO2vakTr2ebbfenup7Pso21yXfDSQWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAztz+mrRt56ey7T5XTryHJ25tffP92fa38xncQpy8HicVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUANi3/VVt1Ezu4WzbJqpMbgHdep+r3+X+zDyLbT7Ldr3esP0FwDr++wuAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQ+Vt90ORGzeQuU2Xyek7cHaps29qyD/bP78+J9/n30n9b3nBSASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYB921/bNnO2bUCduFd24ubSGyfew0mTG3STfxfb9vd+l/1dVJxUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRASDz8zzPcXtK23bGbHbtuc8ncn/23MNv9on+vpxUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRAWDf9hf/fJuo2hCb/JzKiTtsNt/2+Ob3edv9cVIBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgMzfbVs3J5rcFJp8Ftue6eR93rbrte0dO3H/attG1ufAjb43nFQAyIgKABlRASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBYN/21xvbNmpu3S+qbNtcqnaQJjeXJrebbr0/t26s/R646/WGkwoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAnLn99catOz8n7oxtu55K9bsm39Vtql2vSduu57Ps76LipAJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoA925/cdau1zdvJU3uX735nG3vxuT9mXw3tv3t/A6+G284qQCQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJAxvbXYfs8k7tD27aktm0cTT7Tbc/ixF2v6j6fuPn2O/iOOakAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQObneZ4rd5kqt/6uW926N7XtPTxxr6yy7d3YxkkFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADJ//wzatuEzadsG1Imf88bkd53oxN9+6zbapMn746QCQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKAJmf53m6TwPgqzmpAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoA/Kn8H2+LjH50DgzPAAAAAElFTkSuQmCC"));
qrFrame1.fills = [{ type: 'IMAGE', scaleMode: 'FIT', imageHash: imgRev.hash }];
leftBox.appendChild(qrFrame1);

// Alt metin
const c1 = figma.createText();
c1.name = 'Caption 1';
c1.characters = 'Google\'da Puan Verin';
c1.fontSize = 10;
c1.fontName = { family: 'Inter', style: 'Semi Bold' };
c1.fills = [{ type: 'SOLID', color: { r: 0.20, g: 0.28, b: 0.38 } }];
c1.textAlignHorizontal = 'CENTER';
c1.resize(236, 15);
c1.x = 0;
c1.y = 172;
leftBox.appendChild(c1);

const s1 = figma.createText();
s1.name = 'Sub 1';
s1.characters = 'Kameranızı okutarak yorum bırakın';
s1.fontSize = 8.5;
s1.fontName = { family: 'Inter', style: 'Regular' };
s1.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.60, b: 0.68 } }];
s1.textAlignHorizontal = 'CENTER';
s1.resize(236, 14);
s1.x = 0;
s1.y = 188;
leftBox.appendChild(s1);

// ---- 3. SAĞ PANEL: www.atlimedikal.com ----
const rightBox = figma.createFrame();
rightBox.name = 'Panel - Web Sitesi';
rightBox.resize(236, 214);
rightBox.x = 294;
rightBox.y = 54;
rightBox.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.985, b: 0.995 } }];
rightBox.cornerRadius = 6;
rightBox.strokes = [{ type: 'SOLID', color: { r: 0.89, g: 0.91, b: 0.94 } }];
rightBox.strokeWeight = 1;
stand.appendChild(rightBox);

// "www.atlimedikal.com" Başlığı
const t2 = figma.createText();
t2.name = 'Title - Web Address';
t2.characters = 'www.atlimedikal.com';
t2.fontSize = 13.5;
t2.fontName = { family: 'Inter', style: 'Bold' };
t2.fills = [{ type: 'SOLID', color: { r: 0.06, g: 0.09, b: 0.16 } }];
t2.textAlignHorizontal = 'CENTER';
t2.resize(236, 20);
t2.x = 0;
t2.y = 12;
rightBox.appendChild(t2);

// Alt etiket
const tag2 = figma.createText();
tag2.name = 'Web Subtitle';
tag2.characters = 'Online Ürün Kataloğu & İletişim';
tag2.fontSize = 9.5;
tag2.fontName = { family: 'Inter', style: 'Medium' };
tag2.fills = [{ type: 'SOLID', color: { r: 0.35, g: 0.42, b: 0.52 } }];
tag2.textAlignHorizontal = 'CENTER';
tag2.resize(236, 16);
tag2.x = 0;
tag2.y = 33;
rightBox.appendChild(tag2);

// QR Kutu 2 - Web Sitesi QR
const qrFrame2 = figma.createFrame();
qrFrame2.name = 'QR 2 Frame';
qrFrame2.resize(110, 110);
qrFrame2.x = 63;
qrFrame2.y = 54;
qrFrame2.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
qrFrame2.cornerRadius = 6;
qrFrame2.strokes = [{ type: 'SOLID', color: { r: 0.82, g: 0.85, b: 0.89 } }];
qrFrame2.strokeWeight = 1;

const imgWeb = figma.createImage(figma.base64Decode("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J7UAOakFyEktQE5qAXJSC5CTWoCc1AKcvuy1ZTnpvAWyJ6+aFde0Kzb1PLdwqgXISS1ATmoBclILkJNagJzUAuSkFiAntQA5qQXISS1ATmoBclILkJNagNyaZS9+/w5WscY0u6215Zr3zd7RkznVAuSkFiAntQA5qQXISS1ATmoBclILkJNagJzUAuSkFiAntQA5qQXISS1AzrLXAlv2pWxBPdOWVbPX6FaZUy1ATmoBclILkJNagJzUAuSkFiAntQA5qQXISS1ATmoBclILkJNagJzUAuTWLHsVWzvnOW8DbMtu05ZrFmb3ut6jn36fUy1ATmoBclILkJNagJzUAuSkFiAntQA5qQXISS1ATmoBclILkJNagJzUApy+7DW7tbPF7GbVfRaefv+TP2+v677ZX4dTLUBOagFyUguQk1qAnNQC5KQWICe1ADmpBchJLUBOagFyUguQk1qAnNQC5L6v6+o/BeDRnGoBclILkJNagJzUAuSkFiAntQA5qQXISS1ATmoBclILkJNagJzUAuSkFiAntQA5qQXISS1ATmoBclILkJNagJzUAuSkFiAntQA5qQXISS1ATmoBclILkJNagK/a/zfpNDKv7sdZAAAAAElFTkSuQmCC"));
qrFrame2.fills = [{ type: 'IMAGE', scaleMode: 'FIT', imageHash: imgWeb.hash }];
rightBox.appendChild(qrFrame2);

// Alt metin
const c2 = figma.createText();
c2.name = 'Caption 2';
c2.characters = 'Web Sitemizi Ziyaret Edin';
c2.fontSize = 10;
c2.fontName = { family: 'Inter', style: 'Semi Bold' };
c2.fills = [{ type: 'SOLID', color: { r: 0.20, g: 0.28, b: 0.38 } }];
c2.textAlignHorizontal = 'CENTER';
c2.resize(236, 15);
c2.x = 0;
c2.y = 172;
rightBox.appendChild(c2);

const s2 = figma.createText();
s2.name = 'Sub 2';
s2.characters = 'Tüm medikal ürün ve cihazlar';
s2.fontSize = 8.5;
s2.fontName = { family: 'Inter', style: 'Regular' };
s2.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.60, b: 0.68 } }];
s2.textAlignHorizontal = 'CENTER';
s2.resize(236, 14);
s2.x = 0;
s2.y = 188;
rightBox.appendChild(s2);

// ---- 4. ZARİF ALT ÇİZGİ & NOT ----
const div2 = figma.createRectangle();
div2.name = 'Footer Divider';
div2.resize(500, 1);
div2.x = 30;
div2.y = 276;
div2.fills = [{ type: 'SOLID', color: { r: 0.92, g: 0.93, b: 0.95 } }];
stand.appendChild(div2);

const fNote = figma.createText();
fNote.name = 'Footer Note';
fNote.characters = 'Görüşleriniz hizmet kalitemizi artırmamıza yardımcı olur • Teşekkür ederiz';
fNote.fontSize = 8.5;
fNote.fontName = { family: 'Inter', style: 'Regular' };
fNote.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.60, b: 0.68 } }];
fNote.textAlignHorizontal = 'CENTER';
fNote.resize(560, 14);
fNote.x = 0;
fNote.y = 282;
stand.appendChild(fNote);

figma.viewport.scrollAndZoomIntoView([stand]);
return 'Stand başarıyla tamamlandı!';
