import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
// Pretendard must be *delivered*, not merely named in `--font-sans`. The dynamic subset splits the
// Hangul range across 92 woff2 files and the browser fetches only the ranges a page actually paints,
// so the 2MB variable font costs a few tens of KB in practice. Imported before `index.css` so the
// `@font-face` rules land ahead of the token block that references the family.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '../styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
