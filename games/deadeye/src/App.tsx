import { GameBoard } from './components/GameBoard';
import './index.css';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-rose-500/30 selection:text-rose-200">
      <GameBoard />
    </div>
  );
}

export default App;
