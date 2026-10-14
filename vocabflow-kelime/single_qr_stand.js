// Tek QR Stand Tasarımı - Atlı Medikal Google Değerlendirme
const oldNodes = figma.currentPage.findAll(n => n.name && n.name.startsWith('QR Stand'));
for (const n of oldNodes) n.remove();

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

// Ana Stand Frame - 360 x 480 (Standart A6/Masaüstü Dikey Pleksi Oranı)
const stand = figma.createFrame();
stand.name = 'QR Stand - Atlı Medikal Tek QR';
stand.resize(360, 480);
stand.x = 100;
stand.y = 100;
stand.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
stand.cornerRadius = 10;
stand.clipsContent = true;
stand.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.90, b: 0.94 } }];
stand.strokeWeight = 1;
stand.effects = [
  {
    type: 'DROP_SHADOW',
    color: { r: 0.06, g: 0.09, b: 0.16, a: 0.08 },
    offset: { x: 0, y: 4 },
    radius: 16,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL'
  }
];

// Üstte ince 3.5px kurumsal lacivert çizgi
const topBar = figma.createRectangle();
topBar.name = 'Top Accent';
topBar.resize(360, 3.5);
topBar.x = 0;
topBar.y = 0;
topBar.fills = [{ type: 'SOLID', color: { r: 0.06, g: 0.09, b: 0.16 } }];
stand.appendChild(topBar);

// ---- 1. LOGO & FİRMA BAŞLIĞI (ORTALANMIŞ & ZARİF) ----
const logoNode = figma.createNodeFromSvg(`<svg width="40" height="40" viewBox="457 157 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M502 162.143L462.714 240.714H482.357L502 199.643L521.643 240.714H541.286L502 162.143Z" fill="#0F172A"/>
<path opacity="0.18" d="M502 185.357L512.714 210.357H491.286L502 185.357Z" fill="#0F172A"/>
<path d="M502 215.714L509.143 230H494.857L502 215.714Z" fill="#0F172A"/>
</svg>`);
logoNode.name = 'Logo Monogram';
logoNode.resize(26, 26);
logoNode.x = (360 - 26) / 2;
logoNode.y = 18;
stand.appendChild(logoNode);

const brandName = figma.createText();
brandName.name = 'Brand Name';
brandName.characters = 'ATLI MEDİKAL';
brandName.fontSize = 14;
brandName.fontName = { family: 'Inter', style: 'Bold' };
brandName.fills = [{ type: 'SOLID', color: { r: 0.06, g: 0.09, b: 0.16 } }];
brandName.letterSpacing = { value: 1.5, unit: 'PIXELS' };
brandName.textAlignHorizontal = 'CENTER';
brandName.resize(360, 20);
brandName.x = 0;
brandName.y = 48;
stand.appendChild(brandName);

const brandSub = figma.createText();
brandSub.name = 'Brand Subtitle';
brandSub.characters = 'TIBBİ CİHAZ VE SAĞLIK ÜRÜNLERİ';
brandSub.fontSize = 8.5;
brandSub.fontName = { family: 'Inter', style: 'Medium' };
brandSub.fills = [{ type: 'SOLID', color: { r: 0.45, g: 0.50, b: 0.58 } }];
brandSub.letterSpacing = { value: 0.9, unit: 'PIXELS' };
brandSub.textAlignHorizontal = 'CENTER';
brandSub.resize(360, 14);
brandSub.x = 0;
brandSub.y = 68;
stand.appendChild(brandSub);

// İnce ayırıcı çizgi
const div1 = figma.createRectangle();
div1.name = 'Header Divider';
div1.resize(300, 1);
div1.x = 30;
div1.y = 90;
div1.fills = [{ type: 'SOLID', color: { r: 0.90, g: 0.92, b: 0.95 } }];
stand.appendChild(div1);

// ---- 2. DEĞERLENDİRME & YILDIZLAR ----
const evalTitle = figma.createText();
evalTitle.name = 'Evaluation Title';
evalTitle.characters = 'Değerlendirme';
evalTitle.fontSize = 18;
evalTitle.fontName = { family: 'Inter', style: 'Bold' };
evalTitle.fills = [{ type: 'SOLID', color: { r: 0.06, g: 0.09, b: 0.16 } }];
evalTitle.textAlignHorizontal = 'CENTER';
evalTitle.resize(360, 24);
evalTitle.x = 0;
evalTitle.y = 104;
stand.appendChild(evalTitle);

const stars = figma.createText();
stars.name = 'Rating Stars';
stars.characters = '★   ★   ★   ★   ★';
stars.fontSize = 15;
stars.fontName = { family: 'Inter', style: 'Regular' };
stars.fills = [{ type: 'SOLID', color: { r: 0.92, g: 0.69, b: 0.13 } }];
stars.textAlignHorizontal = 'CENTER';
stars.resize(360, 20);
stars.x = 0;
stars.y = 130;
stand.appendChild(stars);

// ---- 3. QR KOD KARTI (BÜYÜK & RAHAT OKUNUR) ----
const qrCard = figma.createFrame();
qrCard.name = 'QR Code Card';
qrCard.resize(200, 200);
qrCard.x = (360 - 200) / 2;
qrCard.y = 162;
qrCard.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
qrCard.cornerRadius = 10;
qrCard.strokes = [{ type: 'SOLID', color: { r: 0.85, g: 0.88, b: 0.92 } }];
qrCard.strokeWeight = 1;
qrCard.effects = [
  {
    type: 'DROP_SHADOW',
    color: { r: 0.06, g: 0.09, b: 0.16, a: 0.04 },
    offset: { x: 0, y: 2 },
    radius: 8,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL'
  }
];

const imgRev = figma.createImage(figma.base64Decode("iVBORw0KGgoAAAANSUhEUgAAAhwAAAIcCAIAAAAynOArAAAMZklEQVR4nO3cwY3jzBVG0WljAuilc3D+oTgHL5UBnQKB/+LhVemcACSKZM9FzeL7eZ7nDwAU/pV8CgCICgAlJxUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBIPO3+qDff//nz7f6/O+/yf158zlvVN81+Uyr377t/kz+rje2vYcnvhu3+kT32UkFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVAPZtf72xbQdp235RtctU3efJfbBtO2Pbdr1u3aQ68d+EE6/5d/D9cVIBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgDO3v07cgKrcut20bWvrzedMftfkDtsb27baJrf1Jv1e+u/YG04qAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAHDv9tetqi2pyjdvkb0xuet1q23bep7XDCcVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMjY/lpkcpuo+q43m0vVLlO1V1Z917a9qck9t23Py67XHk4qAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAHDv9tetGz6T+1fbNsS2bXadaNt+2rb7fOLfxa2cVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQHgzO2vbXtB32zbFtm27aY3bv1dlVu32k685klOKgBkRAWAjKgAkBEVAEQFgH2cVADIiAoAGVEBICMqAGREBYCMqACwb/vr1v2iE+/P5B5XdT3f/B5u2wf75m2rE9+fbZxUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRAWDf9tfk3tSJO0iTv33ymt+49ZlOPq/Jezj5jp24RTb5LH4P/HfVSQWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUA9m1/3erEHaRt1/zGtr2yW217NyavZ9sGXWXb37KTCgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgDcu/21bZto8pqr3aETd7ROfKbf/I6deH9u3db7LLseJxUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAuHf7a3K/aNK2Xa/Ktr2pbe/PrRtQ33yfT3ymn8Fn4aQCQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKAJmf53mu3MM5cUdrcrtp2y6T6znr7+LE/b1b/x3bxkkFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADJ/t+1WTX7OG9+8SVXZtkl14jOtNqkm37Ftv33yuX+W/Ts2+V1OKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACwb/vrxN2qbfs8b0zuIFXf9cbkZte2Z1o5cVvv1vf5jW33sOKkAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgD7tr8q23aZTtyb2rbZdetuVWXb/lV1f7Zdz63v/GfZ/XFSASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYDMz/M8f06zbSup+q5tu16VbdtE296fE+/P5DVve+dv/e2f6Hc5qQCQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogLAvu2vbRtZt24c3bohtu0+V7bty2177rf6LNuFm/wuJxUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyPz9M+jEfafJXabJ+7Ntm+iNbbtVJz6vyrbnvu16fpe9q5OcVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEg8/M8T/JB27Zutm1bbfuuyq33eXLzbdvvuvX+vLFtQ+yz7P15w0kFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVAPZtf53IXtCee3gre1wz92ebz+CG2Bu2vwA4kv/+AiAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGT+Vh/0zfs81a5OdQ9P3DS7dQOqMvnbJ3eiJnnHZjipAJARFQAyogJARlQAyIgKABlRAUBUANjHSQWAjKgAkBEVADKiAsC+7a9v3vk5cVOouuZb99Oq7zpxh+3Ea65Mvs+VbffZSQWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUA9m1/bdu/2rYBVX3Xib992zZRZfJ5bdtG2/bcT/w7vfVv0EkFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADI/z/P8udHkztg3bxNtexbbNugm98FO3I47cctu8rs+tr8A+Gb++wuAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQ+Vt90LYdm8n9qzfXPLndVJm85m07UW+cuMs0eX+2PYtbfZa9h04qAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoALBv+2tyf2ZyU+iNE6952ybVic9i297diZ+zTfW7fpe9Y5OcVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEg8/M8z3EbNTaOvtO2vakTr2ebbfenup7Pso21yXfDSQWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAztz+mrRt56ey7T5XTryHJ25tffP92fa38xncQpy8HicVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUANi3/VVt1Ezu4WzbJqpMbgHdep+r3+X+zDyLbT7Ldr3esP0FwDr++wuAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQ+Vt90ORGzeQuU2Xyek7cHaps29qyD/bP78+J9/n30n9b3nBSASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYB921/bNnO2bUCduFd24ubSGyfew0mTG3STfxfb9vd+l/1dVJxUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRASDz8zzPcXtK23bGbHbtuc8ncn/23MNv9on+vpxUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKABlRAWDf9hf/fJuo2hCb/JzKiTtsNt/2+Ob3edv9cVIBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgMzfbVs3J5rcFJp8Ftue6eR93rbrte0dO3H/attG1ufAjb43nFQAyIgKABlRASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBYN/21xvbNmpu3S+qbNtcqnaQJjeXJrebbr0/t26s/R646/WGkwoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoAnLn99catOz8n7oxtu55K9bsm39Vtql2vSduu57Ps76LipAJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoA925/cdau1zdvJU3uX735nG3vxuT9mXw3tv3t/A6+G284qQCQERUAMqICQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJAxvbXYfs8k7tD27aktm0cTT7Tbc/ixF2v6j6fuPn2O/iOOakAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQObneZ4rd5kqt/6uW926N7XtPTxxr6yy7d3YxkkFgIyoAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADJ//wzatuEzadsG1Imf88bkd53oxN9+6zbapMn746QCQEZUAMiICgAZUQEgIyoAZEQFgIyoAJARFQAyogJARlQAyIgKAJmf53m6TwPgqzmpAJARFQAyogJARlQAyIgKABlRASAjKgBkRAWAjKgAkBEVADKiAkBGVADIiAoAGVEBICMqAGREBYCMqACQERUAMqICQEZUAMiICgAZUQEgIyoA/Kn8H2+LjH50DgzPAAAAAElFTkSuQmCC"));
const qrInner = figma.createFrame();
qrInner.name = 'QR Image';
qrInner.resize(176, 176);
qrInner.x = 12;
qrInner.y = 12;
qrInner.fills = [{ type: 'IMAGE', scaleMode: 'FIT', imageHash: imgRev.hash }];
qrCard.appendChild(qrInner);

stand.appendChild(qrCard);

// ---- 4. ÇAĞRI METNİ (ALT BİLGİ) ----
const cta = figma.createText();
cta.name = 'Call to Action';
cta.characters = 'Google\'da Puan Verin';
cta.fontSize = 13;
cta.fontName = { family: 'Inter', style: 'Semi Bold' };
cta.fills = [{ type: 'SOLID', color: { r: 0.12, g: 0.18, b: 0.28 } }];
cta.textAlignHorizontal = 'CENTER';
cta.resize(360, 18);
cta.x = 0;
cta.y = 376;
stand.appendChild(cta);

const subCta = figma.createText();
subCta.name = 'Sub CTA';
subCta.characters = 'Kameranızı okutarak deneyiminizi paylaşın';
subCta.fontSize = 10;
subCta.fontName = { family: 'Inter', style: 'Regular' };
subCta.fills = [{ type: 'SOLID', color: { r: 0.50, g: 0.55, b: 0.64 } }];
subCta.textAlignHorizontal = 'CENTER';
subCta.resize(360, 15);
subCta.x = 0;
subCta.y = 398;
stand.appendChild(subCta);

// ---- 5. ALT ZARİF BİLGİ & ÇİZGİ ----
const div2 = figma.createRectangle();
div2.name = 'Footer Divider';
div2.resize(300, 1);
div2.x = 30;
div2.y = 432;
div2.fills = [{ type: 'SOLID', color: { r: 0.90, g: 0.92, b: 0.95 } }];
stand.appendChild(div2);

const footer = figma.createText();
footer.name = 'Footer Note';
footer.characters = 'Görüşleriniz hizmet kalitemizi artırmamıza yardımcı olur • Teşekkür ederiz';
footer.fontSize = 8;
footer.fontName = { family: 'Inter', style: 'Regular' };
footer.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.60, b: 0.68 } }];
footer.textAlignHorizontal = 'CENTER';
footer.resize(360, 14);
footer.x = 0;
footer.y = 444;
stand.appendChild(footer);

figma.viewport.scrollAndZoomIntoView([stand]);
return 'Tek QR stand başarıyla oluşturuldu!';
