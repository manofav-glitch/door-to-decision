# Prototype: two cp-01 panels in a "storybook" style, drawn entirely in code (original art).
import base64, pathlib
FONT = base64.b64encode(pathlib.Path('node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2').read_bytes()).decode()

def defs(extra=''):
    return f'''<defs>
<style>@font-face{{font-family:'PH';src:url(data:font/woff2;base64,{FONT}) format('woff2');}}
.letter{{font-family:'PH',cursive;fill:#f4ecd8;letter-spacing:4px}}
.box{{font-family:-apple-system,'Helvetica Neue',sans-serif;font-weight:700;font-size:22px;letter-spacing:2px;fill:#1f262b}}
.line{{fill:none;stroke:#1c1a18;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}}
</style>
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" result="n"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="table" tableValues="0 0.22"/></feComponentTransfer>
</filter>
<radialGradient id="vignette" cx="50%" cy="48%" r="72%">
  <stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.45"/>
</radialGradient>
<pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
  <path d="M0 0 L0 10" stroke="#000" stroke-width="3" opacity="0.28"/>
</pattern>
{extra}
</defs>'''

def finish(svg_body, caption_box):
    return svg_body + f'''
<rect width="1000" height="1000" fill="url(#vignette)"/>
<rect width="1000" height="1000" filter="url(#grain)"/>
<rect x="36" y="34" width="{len(caption_box)*15+40}" height="46" fill="#f1e8d4" stroke="#1c1a18" stroke-width="4"/>
<text x="56" y="66" class="box">{caption_box}</text>
<rect x="4" y="4" width="992" height="992" fill="none" stroke="#1c1a18" stroke-width="8"/>
</svg>'''

def face(cx, cy, r, mood, skin_shadow):
    # eyes, brows and mouth only; plus a soft cheek shadow
    e = r*0.34
    brows = {
      'pain':    f'M{cx-e-14} {cy-r*0.12} L{cx-e+14} {cy-r*0.28} M{cx+e-14} {cy-r*0.28} L{cx+e+14} {cy-r*0.12}',
      'worried': f'M{cx-e-14} {cy-r*0.16} L{cx-e+12} {cy-r*0.26} M{cx+e-12} {cy-r*0.26} L{cx+e+14} {cy-r*0.16}',
      'alarmed': f'M{cx-e-15} {cy-r*0.24} Q{cx-e} {cy-r*0.40} {cx-e+15} {cy-r*0.26} M{cx+e-15} {cy-r*0.26} Q{cx+e} {cy-r*0.40} {cx+e+15} {cy-r*0.24}',
    }[mood]
    mouth = {
      'pain': f'<path d="M{cx-18} {cy+r*0.42} L{cx+18} {cy+r*0.42} L{cx+13} {cy+r*0.30} L{cx-13} {cy+r*0.30} Z" fill="#f1e6d6" stroke="#1c1a18" stroke-width="3.5"/>',
      'worried': f'<path d="M{cx-14} {cy+r*0.42} Q{cx} {cy+r*0.30} {cx+14} {cy+r*0.42}" class="line"/>',
      'alarmed': f'<ellipse cx="{cx}" cy="{cy+r*0.40}" rx="8" ry="11" fill="#3a1e18"/>',
    }[mood]
    return f'''<path d="M{cx+r*0.15} {cy+r*0.95} A{r} {r} 0 0 0 {cx+r} {cy}" fill="{skin_shadow}" opacity="0.55"/>
<circle cx="{cx-e}" cy="{cy}" r="5.5" fill="#1c1a18"/><circle cx="{cx+e}" cy="{cy}" r="5.5" fill="#1c1a18"/>
<path d="{brows}" class="line"/>{mouth}'''

def sweat(x, y, s=1):
    return f'<path d="M{x} {y} q{7*s} {12*s} 0 {17*s} q{-7*s} {-5*s} 0 {-17*s} z" fill="#d6ecf2" stroke="#1c1a18" stroke-width="2.5"/>'

# ------------------------------------------------------------------ panel 1: triage at 02:10
p1 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
{defs("""
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16263a"/><stop offset="1" stop-color="#2d4a63"/></linearGradient>
<linearGradient id="warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd48a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd48a" stop-opacity="0"/></linearGradient>
<radialGradient id="pool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#8c6a45" stop-opacity="0.7"/><stop offset="1" stop-color="#8c6a45" stop-opacity="0"/></radialGradient>
""")}
<rect width="1000" height="760" fill="#2b4556"/>
<rect y="690" width="1000" height="70" fill="#233947"/>
<rect y="760" width="1000" height="240" fill="#3d3530"/>
<path d="M0 840 L1000 840 M0 920 L1000 920 M180 760 L120 1000 M420 760 L400 1000 M660 760 L690 1000 M880 760 L950 1000" stroke="#352e2a" stroke-width="3"/>
<ellipse cx="760" cy="860" rx="300" ry="70" fill="url(#pool)"/>
<!-- window with the night outside -->
<rect x="38" y="300" width="200" height="270" fill="url(#sky)" stroke="#16222b" stroke-width="10"/>
<path d="M138 300 L138 570 M38 435 L238 435" stroke="#16222b" stroke-width="8"/>
<circle cx="185" cy="350" r="24" fill="#efe1bb"/><circle cx="185" cy="350" r="44" fill="#efe1bb" opacity="0.12"/>
<g fill="#efe1bb"><circle cx="70" cy="330" r="2.5"/><circle cx="105" cy="375" r="2"/><circle cx="210" cy="480" r="2"/><circle cx="80" cy="500" r="2.5"/></g>
<!-- sign, clock -->
<rect x="440" y="300" width="230" height="58" fill="#d9cfb2" stroke="#16222b" stroke-width="5"/>
<text x="555" y="340" text-anchor="middle" font-family="PH" font-size="36" letter-spacing="8" fill="#2b2622">TRIAGE</text>
<circle cx="900" cy="330" r="44" fill="#efe4c6" stroke="#16222b" stroke-width="6"/>
<path d="M900 330 L925 318 M900 330 L930 343" stroke="#16222b" stroke-width="5" stroke-linecap="round"/>
<!-- pendant lamp and its warm light -->
<path d="M760 0 L760 372" stroke="#16222b" stroke-width="4"/>
<path d="M705 400 L815 400 L790 368 L730 368 Z" fill="#c9793a" stroke="#1c1a18" stroke-width="4"/>
<path d="M708 402 L812 402 L990 700 L530 700 Z" fill="url(#warm)"/>
<!-- nurse behind the desk -->
<path d="M665 700 L678 612 Q760 580 842 612 L855 700 Z" fill="#3e7a73" stroke="#1c1a18" stroke-width="4"/>
<path d="M738 600 L760 648 L782 600" class="line"/>
<rect x="600" y="0" width="0" height="0"/>
<path d="M744 575 L744 605 L776 605 L776 575" fill="#8b5a3d" stroke="#1c1a18" stroke-width="4"/>
<circle cx="760" cy="535" r="46" fill="#8b5a3d" stroke="#1c1a18" stroke-width="4"/>
<path d="M714 530 Q712 482 760 480 Q808 482 806 530 Q796 500 760 498 Q724 500 714 530 Z" fill="#1d1917"/>
<circle cx="760" cy="470" r="20" fill="#1d1917"/>
{face(760, 540, 46, 'worried', '#6e4530')}
<!-- desk -->
<rect x="520" y="690" width="480" height="26" fill="#9c6b45" stroke="#1c1a18" stroke-width="4"/>
<rect x="540" y="716" width="460" height="200" fill="#6e4931" stroke="#1c1a18" stroke-width="4"/>
<path d="M600 740 L600 900 M760 740 L760 900 M920 740 L920 900" stroke="#5a3b27" stroke-width="4"/>
<rect x="866" y="608" width="112" height="78" rx="4" fill="#2a2d31" stroke="#1c1a18" stroke-width="4"/>
<path d="M922 686 L922 692" stroke="#1c1a18" stroke-width="8"/>
<rect x="585" y="668" width="60" height="22" fill="#e9e1cf" stroke="#1c1a18" stroke-width="3" transform="rotate(-6 615 679)"/>
<!-- the patient, sitting, hand pressed to his chest -->
<ellipse cx="330" cy="968" rx="150" ry="22" fill="url(#hatch)"/>
<rect x="540" y="916" width="460" height="40" fill="url(#hatch)"/>
<path d="M222 596 L438 596 L446 790 L214 790 Z" fill="#b5653b" stroke="#1c1a18" stroke-width="4"/>
<path d="M222 596 L438 596 L440 640 L220 640 Z" fill="#9a5431"/>
<path d="M232 800 L222 960 M428 800 L438 960" stroke="#7a4428" stroke-width="8" stroke-linecap="round"/>
<path d="M262 790 L398 790 L420 872 L240 872 Z" fill="#373e4b" stroke="#1c1a18" stroke-width="4"/>
<path d="M326 800 L330 868" stroke="#2a303b" stroke-width="4"/>
<path d="M206 792 L454 792 L454 806 L206 806 Z" fill="#9a5431" stroke="#1c1a18" stroke-width="4"/>
<path d="M246 870 L256 956 L318 956 L322 872 Z M338 872 L342 956 L404 956 L414 870 Z" fill="#373e4b" stroke="#1c1a18" stroke-width="4"/>
<ellipse cx="290" cy="964" rx="36" ry="12" fill="#1d1b1a"/><ellipse cx="370" cy="964" rx="36" ry="12" fill="#1d1b1a"/>
<path d="M248 612 Q256 586 330 580 Q404 586 412 612 L398 792 L262 792 Z" fill="#dcd4c1" stroke="#1c1a18" stroke-width="4"/>
<path d="M360 600 Q404 610 398 800 L352 800 Z" fill="#c3baa6"/>
<path d="M312 590 L330 624 L348 590 M330 624 L330 790" class="line"/>
<circle cx="326" cy="680" r="3.5" fill="#1c1a18"/><circle cx="326" cy="730" r="3.5" fill="#1c1a18"/>
<path d="M404 616 Q432 690 420 766" stroke="#1c1a18" stroke-width="44" stroke-linecap="round" fill="none"/><path d="M404 616 Q432 690 420 766" stroke="#dcd4c1" stroke-width="36" stroke-linecap="round" fill="none"/>
<circle cx="420" cy="780" r="20" fill="#9a6444" stroke="#1c1a18" stroke-width="4"/>
<path d="M256 616 Q226 690 256 720 Q286 700 308 670" stroke="#1c1a18" stroke-width="44" stroke-linecap="round" fill="none"/><path d="M256 616 Q226 690 256 720 Q286 700 308 670" stroke="#dcd4c1" stroke-width="36" stroke-linecap="round" fill="none"/>
<path d="M300 648 Q300 630 322 632 Q346 632 346 652 L344 676 Q330 688 308 680 Q298 668 300 648 Z" fill="#9a6444" stroke="#1c1a18" stroke-width="4"/>
<path d="M312 640 Q314 652 312 662 M324 638 Q326 652 324 664 M336 642 Q338 654 336 664" stroke="#6e4530" stroke-width="3" fill="none"/>
<path d="M312 540 L312 598 L348 598 L348 540" fill="#9a6444" stroke="#1c1a18" stroke-width="4"/>
<circle cx="330" cy="500" r="56" fill="#9a6444" stroke="#1c1a18" stroke-width="4"/>
<path d="M275 498 Q270 440 330 438 Q390 440 386 492 Q372 460 334 462 Q292 462 275 498 Z" fill="#26211e"/>
<path d="M300 468 Q330 458 358 470" stroke="#7d756e" stroke-width="3" fill="none"/>
{face(330, 506, 56, 'pain', '#7a4c33')}
<path d="M306 540 Q330 530 354 540" stroke="#5c5650" stroke-width="7" stroke-linecap="round" fill="none"/>
{sweat(388, 470)}{sweat(276, 488, 0.8)}{sweat(352, 452, 0.7)}
<!-- the line, lettered on the picture -->
<text x="500" y="150" text-anchor="middle" class="letter" font-size="76">IT'S LIKE A WEIGHT</text>
<text x="500" y="238" text-anchor="middle" class="letter" font-size="76">ON MY CHEST.</text>
'''
p1 = finish(p1, '02:10 · TRIAGE')

# ------------------------------------------------------------------ panel 2: resus, BP falling after the nitrate
p2 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
{defs("""
<linearGradient id="cold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf5f0" stop-opacity="0.22"/><stop offset="1" stop-color="#eaf5f0" stop-opacity="0"/></linearGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ef4b3f" stop-opacity="0.45"/><stop offset="1" stop-color="#ef4b3f" stop-opacity="0"/></radialGradient>
""")}
<rect width="1000" height="720" fill="#2b4a46"/>
<rect y="720" width="1000" height="280" fill="#303c39"/>
<path d="M0 800 L1000 800 M0 890 L1000 890 M250 720 L200 1000 M520 720 L520 1000 M790 720 L850 1000" stroke="#28322f" stroke-width="3"/>
<!-- curtain -->
<path d="M0 56 L250 56" stroke="#16222b" stroke-width="6"/>
<path d="M0 60 L240 60 L230 720 L0 720 Z" fill="#6a8a7d"/>
<path d="M30 60 Q18 380 34 720 M86 60 Q98 380 80 720 M140 60 Q126 400 146 720 M196 60 Q210 380 190 720" stroke="#55746a" stroke-width="16" fill="none"/>
<!-- harsh overhead light -->
<rect x="420" y="0" width="220" height="26" fill="#dce6e2" stroke="#1c1a18" stroke-width="4"/>
<path d="M430 26 L630 26 L930 760 L150 760 Z" fill="url(#cold)"/>
<!-- the monitor: the only red is the alarm -->
<ellipse cx="760" cy="250" rx="220" ry="150" fill="url(#glow)"/>
<rect x="620" y="150" width="284" height="196" rx="8" fill="#1a1e1e" stroke="#1c1a18" stroke-width="5"/>
<rect x="636" y="166" width="252" height="164" fill="#0b1413"/>
<path d="M646 222 h36 l8 -22 l10 40 l8 -18 h40 l8 -22 l10 40 l8 -18 h40" stroke="#6fd39a" stroke-width="3.5" fill="none"/>
<text x="876" y="212" text-anchor="end" font-family="-apple-system,sans-serif" font-weight="700" font-size="34" fill="#6fd39a">52</text>
<text x="650" y="298" font-family="-apple-system,sans-serif" font-weight="700" font-size="16" fill="#8aa29b">NIBP</text>
<text x="876" y="310" text-anchor="end" font-family="-apple-system,sans-serif" font-weight="800" font-size="46" fill="#ef4b3f">66/40</text>
<path d="M650 176 L664 198 L636 198 Z" fill="#ef4b3f"/>
<path d="M346 196 L346 196" />
<text x="760" y="118" text-anchor="middle" font-family="PH" font-size="48" letter-spacing="4" fill="#ef4b3f" transform="rotate(-5 760 118)">BEEP · BEEP · BEEP</text>
<!-- trolley and the patient, ashen -->
<rect x="160" y="712" width="560" height="30" rx="6" fill="#d6dde0" stroke="#1c1a18" stroke-width="4"/>
<path d="M190 742 L190 900 M690 742 L690 900 M190 880 L690 880" stroke="#7c8a8a" stroke-width="8" stroke-linecap="round"/>
<ellipse cx="440" cy="945" rx="300" ry="26" fill="url(#hatch)"/>
<circle cx="190" cy="920" r="18" fill="#2a2d2d" stroke="#1c1a18" stroke-width="4"/><circle cx="690" cy="920" r="18" fill="#2a2d2d" stroke="#1c1a18" stroke-width="4"/>
<ellipse cx="250" cy="700" rx="78" ry="24" fill="#eef1f1" stroke="#1c1a18" stroke-width="4"/>
<path d="M300 716 Q330 600 470 612 Q600 624 700 690 L712 716 Z" fill="#b8ccd5" stroke="#1c1a18" stroke-width="4"/>
<path d="M360 650 Q440 640 520 660 M420 690 Q500 676 600 694" stroke="#9cb3bd" stroke-width="5" fill="none"/>
<path d="M450 640 Q520 612 556 660" stroke="#1c1a18" stroke-width="36" stroke-linecap="round" fill="none"/><path d="M450 640 Q520 612 556 660" stroke="#dcd4c1" stroke-width="28" stroke-linecap="round" fill="none"/>
<circle cx="566" cy="674" r="17" fill="#8f7568" stroke="#1c1a18" stroke-width="4"/>
<g transform="rotate(-14 250 650)">
<circle cx="250" cy="650" r="52" fill="#8f7568" stroke="#1c1a18" stroke-width="4"/>
<path d="M198 648 Q196 594 250 592 Q304 594 302 642 Q288 614 252 614 Q214 614 198 648 Z" fill="#26211e"/>
{face(250, 656, 52, 'pain', '#6d5448')}
</g>
{sweat(300, 610)}{sweat(206, 628, 0.8)}
<!-- nurse leaning in -->
<path d="M770 1000 L786 790 L884 790 L902 1000 Z" fill="#35696a" stroke="#1c1a18" stroke-width="4"/>
<path d="M760 600 Q830 572 902 600 L890 800 L776 800 Z" fill="#3e7a73" stroke="#1c1a18" stroke-width="4"/>
<path d="M808 594 L830 640 L852 594" class="line"/>
<path d="M770 616 Q690 636 606 650" stroke="#1c1a18" stroke-width="40" stroke-linecap="round" fill="none"/><path d="M770 616 Q690 636 606 650" stroke="#3e7a73" stroke-width="32" stroke-linecap="round" fill="none"/>
<path d="M548 652 Q560 638 590 642 Q606 646 604 660 Q590 668 566 668 Q550 666 548 652 Z" fill="#7a4b33" stroke="#1c1a18" stroke-width="4"/>
<path d="M814 566 L814 598 L846 598 L846 566" fill="#7a4b33" stroke="#1c1a18" stroke-width="4"/>
<circle cx="830" cy="526" r="46" fill="#7a4b33" stroke="#1c1a18" stroke-width="4"/>
<path d="M784 522 Q782 472 830 470 Q878 472 876 522 Q866 492 830 490 Q794 492 784 522 Z" fill="#1d1917"/>
<circle cx="830" cy="462" r="20" fill="#1d1917"/>
{face(830, 530, 46, 'alarmed', '#5e3825')}
<!-- the line -->
<text x="300" y="170" text-anchor="middle" class="letter" font-size="72">HIS PRESSURE</text>
<text x="300" y="252" text-anchor="middle" class="letter" font-size="72">IS FALLING.</text>
'''
p2 = finish(p2, '02:12 · RESUS BAY')

pathlib.Path('panel-1-triage.svg').write_text(p1)
pathlib.Path('panel-2-resus.svg').write_text(p2)
print('ok', len(p1)//1024, 'KB', len(p2)//1024, 'KB (each includes a ~32 KB embedded font)')
