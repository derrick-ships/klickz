# Mobile backdrop correction — 2026-11-08
The supplied IMG_9091.jpeg was inspected. Its flat gray right side reproduced when the backdrop button received hover: the global button:hover:not(:disabled) rule won the cascade and painted rgb(42,42,42). The new regression failed with that exact value before correction.

The backdrop is excluded from generic button hover. It keeps its 14% translucent tint. Visual inspection also found WebKit reporting backdrop-filter while not visibly blurring the underlying page. Blur now applies directly to the mounted workspace (6px), preserving inert/focus behavior. No page is removed or replaced.

Pointer entry/exit durations are matched at 240ms/200ms. Keyboard and reduced-motion paths remain immediate. Tests cover hover, real touch dismissal/reopening, interrupted navigation, 320/390/430 widths, reduced motion and desktop layout. Rendered open/transition/closed/reduced states were inspected. Browser engine checks are not physical iPhone testing.

No credentials, provider calls, backend data or API contracts change.
