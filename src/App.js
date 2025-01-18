import './App.css';
import AudioStreamingApp from './components/AudioStreamingApp';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-blue-400 to-blue-600 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 w-5/6 sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-5">
          <AudioStreamingApp />
        </div>
      </div>
    </div>
  );
}

export default App;
