import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'

const root = document.getElementById('app')!
root.innerHTML = ''
render(<App />, root)
