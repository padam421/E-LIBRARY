# Catalogue dependencies

These pinned files are loaded only by `catalogue.html`. They add no build step,
external CDN requests, or stylesheet changes to the existing library pages.

| File | Package | Source |
| --- | --- | --- |
| react-18.3.1.min.js | React 18.3.1 production UMD | https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js |
| react-dom-18.3.1.min.js | React DOM 18.3.1 production UMD | https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js |
| bootstrap-5.3.8.min.css | Bootstrap 5.3.8 CSS | https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css |

React 18 is intentionally pinned for its browser UMD distribution, so the
existing static deployment does not need a bundler. All three packages are MIT
licensed; their original license texts are included alongside the files.

Bootstrap's JavaScript is unnecessary for the grid, tables, forms and buttons
used here. Custom interactions are managed by React.
