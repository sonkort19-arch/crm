Файлы логотипа Too CRM
======================

logo.svg — основной вектор (светлая тема), для вставки в HTML и правок в Figma/Inkscape.

logo-dark.svg — тот же знак для тёмной темы (светлый силуэт).

favicon.svg — копия знака для вкладки браузера (SVG).

favicon-32.png — растр 32×32 для старых браузеров / когда нужен PNG.

apple-touch-icon.png — 180×180, иконка при добавлении сайта на экран телефона (iOS/Android).

logo-512.png — крупный растр для презентаций, писем и документов (вставка в Word, подпись почты и т.д.).

Пересборка PNG из logo.svg (при изменении SVG): в корне проекта установите sharp и выполните:
  node -e "const s=require('sharp');s('assets/logo.svg').resize(180,180).png().toFile('assets/apple-touch-icon.png');s('assets/logo.svg').resize(32,32).png().toFile('assets/favicon-32.png');s('assets/logo.svg').resize(512,512).png().toFile('assets/logo-512.png');"
