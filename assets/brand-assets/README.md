# Alamos Capital — Brand Assets

Paquete de identidad. Todo derivado de un solo sistema: dos triángulos superpuestos con composición **tight overlap** (verde atrás a la izquierda, negro al frente a la derecha).

---

## Estructura

```
brand-assets/
├── app/                   Logo de la app (halo, sólido con resplandor)
│   ├── app-isotipo.svg    · solo triángulos, sin fondo
│   ├── app-icon-light.svg · con fondo claro + esquinas redondeadas
│   ├── app-icon-1024.svg  · mismo, export 1024px
│   └── png/               · 512, 1024, 2048 px
│
├── empresa/               Logo corporativo (outline bold — brand mode)
│   ├── brand-isotipo.svg         · triángulos outline, sin fondo
│   ├── brand-isotipo-dark.svg    · para usar sobre fondos oscuros
│   ├── brand-icon-light.svg      · con fondo claro
│   ├── brand-icon-dark.svg       · con fondo oscuro
│   ├── brand-lockup.svg          · ícono + "Alamos Capital"
│   ├── brand-lockup-dark.svg     · versión oscura
│   └── png/                      · todos los anteriores en PNG
│
├── empresa-mono/          Logo monocromático (un solo color, para fondos fuertes)
│   ├── brand-mono-white-*.svg   · todo blanco — sobre verde, oscuro, fotos
│   ├── brand-mono-black-*.svg   · todo negro — sobre claros/pastel
│   ├── brand-mono-green-*.svg   · todo verde — sobre oscuro (máximo contraste de marca)
│   └── png/                     · todos los anteriores en PNG
│
└── README.md (este archivo)
```

---

## Cuándo usar cada uno

| Contexto                                  | Archivo                              |
|-------------------------------------------|--------------------------------------|
| Ícono de app (iOS, Android, favicon)      | `app/app-icon-light.svg`             |
| Avatar de redes sociales                  | `app/png/app-icon-1024.png`          |
| Logo en sitio web / presentaciones        | `empresa/brand-lockup.svg`           |
| Logo sobre fondo oscuro                   | `empresa/brand-lockup-dark.svg`      |
| Isotipo solo (sello, watermark)           | `empresa/brand-isotipo.svg`          |
| Tarjetas personales, papelería            | `empresa/brand-lockup.svg`           |
| Email signature (PNG)                     | `empresa/png/brand-lockup-1024.png`  |
| Sobre fondo verde de marca                | `empresa-mono/brand-mono-white-lockup.svg` |
| Sobre fondo oscuro pleno                  | `empresa-mono/brand-mono-white-lockup.svg` |
| Sobre foto/imagen                         | `empresa-mono/brand-mono-white-lockup.svg` |
| Papelería premium / sellos en oscuro      | `empresa-mono/brand-mono-green-lockup.svg` |

**Regla general:**
- Con espacio para el texto → usá el lockup. Si no, el isotipo.
- Fondo neutro (claro u oscuro) → versión **empresa** (brand: verde + color).
- Fondo de color, foto, o superficie "vestida" → versión **empresa-mono** (un solo color).
- Elegí el color mono que dé mejor contraste con el fondo: blanco para casi todo, negro sólo sobre colores muy claros, verde sólo como detalle premium sobre oscuro.

---

## Tokens

### Color
- Verde `#00E676`
- Negro `#0E0F0C`
- Claro `#FAFAF7`

### Tipografía
- **Plus Jakarta Sans**, weight 700, letter-spacing −0.045em
- Texto: "Alamos Capital" (sin tilde en la A)

### Geometría
- viewBox 0–100 (SVG coords)
- Triángulo trasero (verde): centrado en x=38, ancho 44, alto 60
- Triángulo delantero (negro): centrado en x=56, ancho 54, alto 74
- Ambos apoyados en base y=86
- Outline stroke-width: 5.5 (empresa)

---

## Guía de uso

### Respetar el área de respiro
Dejá un margen mínimo alrededor del logo equivalente al ancho de un triángulo pequeño. No lo arrincones.

### No hacer
- No cambiar los colores (ni "verde Alamos pero más pastel")
- No separar los triángulos
- No rotarlo
- No añadir sombras extras al logo empresa — es outline puro
- No cambiar la tipografía del lockup
- No estirar ni achatar

### Tamaño mínimo
- Isotipo: 16px
- Lockup: 120px de ancho

---

## Tech notes

Los SVGs usan `viewBox="0 0 100 100"` para escalar a cualquier tamaño sin pérdida. El filtro `halo` del app icon requiere SVG + filter support (todos los browsers modernos ✓). Si necesitás una versión flat para exports a PDF vectorial, usá `empresa/brand-isotipo.svg` como base.

Fuente: Plus Jakarta Sans, disponible en Google Fonts.
