import OrbView from './routes/OrbView'
import MainView from './routes/MainView'
import OverlayView from './routes/OverlayView'

export default function App({ route }: { route: string }): JSX.Element {
  if (route === 'orb') return <OrbView />
  if (route === 'overlay') return <OverlayView />
  return <MainView />
}
