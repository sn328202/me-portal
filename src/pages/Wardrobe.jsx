import React from 'react';

// The Wardrobe is a self-contained outfit + trip + packing planner. It lives as
// a standalone HTML app in /public and is embedded here full-bleed so its own
// state (localStorage) and behaviour carry over untouched. Served statically
// via the vercel.json rewrite exemption for /outfit-planner.html.
export default function Wardrobe() {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <iframe
        src="/outfit-planner.html"
        title="The Wardrobe — outfit & trip planner"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    </div>
  );
}
