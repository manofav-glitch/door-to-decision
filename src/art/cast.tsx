// The cast: minimalist busts drawn in code. Coordinates are relative to the bottom-centre of
// the figure (0,0); the head centre is at (0,-128). Colours come from CSS tokens, so dark mode
// works automatically. Stroke width is set once for all art in src/index.css (.art).
import type { Actor, Mood } from './registry';

const HEAD_Y = -128;

// ---------- face: expression via eyebrows and mouth only ----------

const BROWS: Record<Mood, string> = {
  neutral: 'M-16 -141 L-6 -141 M6 -141 L16 -141',
  pain: 'M-16 -138 L-5 -145 M5 -145 L16 -138',
  worried: 'M-16 -139 L-6 -143 M6 -143 L16 -139',
  relieved: 'M-16 -140 Q-11 -144 -6 -141 M6 -141 Q11 -144 16 -140',
  alarmed: 'M-17 -144 Q-11 -151 -5 -146 M5 -146 Q11 -151 17 -144',
};

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'neutral':
      return <path d="M-6 -113 L6 -113" />;
    case 'pain':
      return (
        <path
          d="M-9 -110 L9 -110 L6 -115 L-6 -115 Z M-9 -110 L-6 -115 M9 -110 L6 -115"
          className="fill-paper"
        />
      );
    case 'worried':
      return <path d="M-7 -110 Q0 -116 7 -110" />;
    case 'relieved':
      return <path d="M-9 -116 Q0 -107 9 -116" />;
    case 'alarmed':
      return <ellipse cx="0" cy="-112" rx="4.5" ry="6" className="fill-paper" />;
  }
}

function Face({ mood, glasses }: { mood: Mood; glasses?: boolean }) {
  return (
    <g>
      <circle cx="-10" cy="-131" r="2.4" className="fill-ink" stroke="none" />
      <circle cx="10" cy="-131" r="2.4" className="fill-ink" stroke="none" />
      {glasses && (
        <path
          d="M-19 -136 h14 v9 h-14 Z M5 -136 h14 v9 h-14 Z M-5 -133 L5 -133 M-19 -134 L-29 -137 M19 -134 L29 -137"
          className="fill-none"
        />
      )}
      <path d={BROWS[mood]} className="fill-none" />
      <Mouth mood={mood} />
      {mood === 'pain' && (
        // a bead of cold sweat at the temple
        <path d="M27 -146 Q31 -139 27 -136 Q23 -139 27 -146 Z" className="fill-paper" />
      )}
    </g>
  );
}

// ---------- shared body parts ----------

const TORSO = 'M-48 0 L-42 -78 Q0 -98 42 -78 L48 0 Z';

function Torso() {
  return <path d={TORSO} className="fill-paper" />;
}
function Neck() {
  return <path d="M-9 -88 L-9 -102 M9 -88 L9 -102" />;
}
function Head({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <circle cx="0" cy={HEAD_Y} r="30" className="fill-paper" />
      {children}
    </>
  );
}
/** A hand on the chest: the classic "heavy chest" pose. */
function ClutchChest() {
  // upper arm down the side, forearm across, fist pressed on the sternum
  return (
    <>
      <path d="M-40 -76 Q-50 -48 -40 -26 Q-24 -30 -10 -48" className="fill-none" />
      <circle cx="-5" cy="-52" r="8" className="fill-paper" />
      <path d="M-9 -57 L-2 -57 M-10 -52 L-1 -52" className="fill-none" />
    </>
  );
}

const SHORT_HAIR =
  'M-30 -126 Q-31 -162 0 -162 Q31 -162 30 -126 Q26 -146 8 -148 Q-12 -150 -30 -126 Z';

// ---------- the cast ----------

function Patient({ mood }: { mood: Mood }) {
  return (
    <g>
      <Torso />
      <path d="M-12 -88 L0 -72 L12 -88 M0 -72 L0 0" className="fill-none" />
      <circle cx="-4" cy="-52" r="1.6" className="fill-ink" stroke="none" />
      <circle cx="-4" cy="-30" r="1.6" className="fill-ink" stroke="none" />
      <Neck />
      <Head>
        <path d={SHORT_HAIR} className="fill-ink" />
        <Face mood={mood} />
      </Head>
      {mood === 'pain' && <ClutchChest />}
    </g>
  );
}

function Doctor({ mood }: { mood: Mood }) {
  return (
    <g>
      <Torso />
      {/* white coat lapels over a shirt */}
      <path
        d="M-32 -82 L-10 -30 L-10 0 M32 -82 L10 -30 L10 0 M-8 -88 L0 -76 L8 -88"
        className="fill-none"
      />
      {/* stethoscope */}
      <path d="M-16 -90 Q-30 -60 -16 -44 Q-4 -34 6 -46" className="fill-none" />
      <circle cx="8" cy="-50" r="5" className="fill-paper" />
      <Neck />
      <Head>
        <path
          d="M-30 -124 Q-32 -162 2 -162 Q30 -160 30 -128 Q18 -150 -8 -146 Q-22 -142 -30 -124 Z"
          className="fill-ink"
        />
        <Face mood={mood} />
      </Head>
    </g>
  );
}

function Nurse({ mood }: { mood: Mood }) {
  return (
    <g>
      <Torso />
      {/* scrub top: V-neck, pocket with pen, fob watch */}
      <path
        d="M-15 -88 L0 -62 L15 -88 M-34 -46 h20 v18 h-20 Z M-28 -46 L-28 -54"
        className="fill-none"
      />
      <circle cx="24" cy="-54" r="5" className="fill-paper" />
      <path d="M24 -54 L24 -57 M24 -54 L26 -53" className="fill-none" />
      <Neck />
      <Head>
        <circle cx="0" cy="-166" r="11" className="fill-ink" />
        <path d={SHORT_HAIR} className="fill-ink" />
        <Face mood={mood} />
      </Head>
    </g>
  );
}

function Senior({ mood }: { mood: Mood }) {
  return (
    <g>
      <Torso />
      <path
        d="M-32 -82 L-10 -30 L-10 0 M32 -82 L10 -30 L10 0 M-8 -88 L0 -76 L8 -88 M0 -76 L-4 -40 L0 -34 L4 -40 Z"
        className="fill-none"
      />
      <Neck />
      <Head>
        {/* greying, receding hair: sides only */}
        <path
          d="M-30 -122 Q-32 -146 -20 -152 M30 -122 Q32 -146 20 -152"
          className="fill-none stroke-grey-1"
        />
        <Face mood={mood} glasses />
      </Head>
    </g>
  );
}

function Relative({ mood }: { mood: Mood }) {
  return (
    <g>
      {/* long hair behind the shoulders */}
      <path d="M-30 -128 Q-40 -90 -38 -74 L38 -74 Q40 -90 30 -128 Z" className="fill-ink" />
      <Torso />
      {/* kurta neckline and a dupatta over one shoulder */}
      <path d="M-10 -88 Q0 -78 10 -88" className="fill-none" />
      <path d="M-44 -64 Q2 -36 46 -80 M-46 -48 Q4 -20 47 -66" className="fill-none" />
      <Neck />
      <Head>
        <path
          d="M-30 -122 Q-32 -162 0 -162 Q32 -162 30 -122 Q24 -150 0 -150 Q-24 -150 -30 -122 Z"
          className="fill-ink"
        />
        <Face mood={mood} />
      </Head>
    </g>
  );
}

function Paramedic({ mood }: { mood: Mood }) {
  return (
    <g>
      <Torso />
      {/* jacket: zip, reflective band, shoulder radio */}
      <path d="M0 -92 L0 0 M-46 -34 L46 -34 M-46 -26 L46 -26" className="fill-none" />
      <path d="M26 -86 h10 v16 h-10 Z M31 -86 L31 -94" className="fill-paper" />
      <Neck />
      <Head>
        <path d={SHORT_HAIR} className="fill-ink" />
        <Face mood={mood} />
      </Head>
    </g>
  );
}

/** Patient lying on a trolley. Anchor (0,0) is the floor under the trolley's centre. */
function PatientSupine({ mood }: { mood: Mood }) {
  return (
    <g>
      {/* trolley */}
      <path
        d="M-120 -40 L120 -40 M-110 -40 L-110 -12 M110 -40 L110 -12 M-110 -18 L110 -18"
        className="fill-none"
      />
      <circle cx="-104" cy="-6" r="6" className="fill-paper" />
      <circle cx="104" cy="-6" r="6" className="fill-paper" />
      {/* pillow, body under a sheet, arm resting on it */}
      <ellipse cx="-92" cy="-50" rx="26" ry="10" className="fill-paper" />
      <path
        d="M-66 -40 Q-60 -74 -24 -72 Q20 -70 40 -58 Q80 -54 116 -46 L116 -40 Z"
        className="fill-paper"
      />
      <path d="M-40 -66 Q-10 -60 18 -64" className="fill-none" />
      <g transform="translate(-84 -58) rotate(-12) translate(0 128)">
        <Head>
          <path d={SHORT_HAIR} className="fill-ink" />
          <Face mood={mood} />
        </Head>
      </g>
    </g>
  );
}

export const CAST: Record<Actor, (p: { mood: Mood }) => React.ReactElement> = {
  patient: Patient,
  'patient-supine': PatientSupine,
  doctor: Doctor,
  nurse: Nurse,
  relative: Relative,
  paramedic: Paramedic,
  senior: Senior,
};
