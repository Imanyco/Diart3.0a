import React from 'react';
import io from 'socket.io-client';

const kaldiServerUrl = 'http://localhost:8888';
const bufferSize = 2048;

function App() {
    const [socket, setSocket] = React.useState(null);
    const [started, setStarted] = React.useState(false);
    const [status, setStatus] = React.useState("Press start");
    const [result, setResult] = React.useState([]);
    const [lastTrans, setLastTrans] = React.useState("💤");

    const audioContextRef = React.useRef(null);
    const streamRef = React.useRef(null);
    const processorRef = React.useRef(null);
    const inputRef = React.useRef(null);

    const startRecog = () => {
        setStarted(true);
        setStatus("Connecting...");

        var newSock = io.connect(kaldiServerUrl);

        newSock.on('disconnect', function()
        {
            console.log('Closed data channel');
            stopRecog();
        });

        newSock.on('connect', function () {
            console.log('Opened data channel');
            var constraints = {
                audio: true,
                video: false,
            };

            var AudioContext = window.AudioContext || window.webkitAudioContext;
            var context = new AudioContext({
                // if Non-interactive, use 'playback' or 'balanced' // https://developer.mozilla.org/en-US/docs/Web/API/AudioContextLatencyCategory
                latencyHint: 'interactive',
            });
            audioContextRef.current = context;

            var processor = context.createScriptProcessor(bufferSize, 1, 1);
            processor.connect(context.destination);
            processorRef.current = processor;
            context.resume();

            var microphoneProcess = function (e) {
                var left = e.inputBuffer.getChannelData(0);
                // var left16 = convertFloat32ToInt16(left); // old 32 to 16 function
                var left16 = downsampleBuffer(left, 44100, 16000)
                newSock.send(left16);
            }


            navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
                streamRef.current = stream;
                var input = context.createMediaStreamSource(stream);
                input.connect(processor);
                inputRef.current = input;

                processor.onaudioprocess = function (e) {
                    microphoneProcess(e);
                };
            }, function (err) {
                console.log('Could not acquire media: ' + err);
                setStarted(false);
                setStatus("Press start");
                setLastTrans("💤")
            });
        });

        newSock.on('message', function (data) {
            setStatus("Listening...");
            console.log(data);
            var msg = JSON.parse(data);
            if (msg.text) {
                setResult(result => [...result, `${msg.spk[0]} : [ ${msg.spk[1]} -->  ${msg.spk[2]} ]`]);
                setLastTrans("...");
            } else if (msg.partial) {
                setLastTrans(`${msg.spk[0]} : [ ${msg.spk[1]} -->  ${msg.spk[2]} ]`);
            } else {
                console.log("oh");
            }

            var objDiv = document.getElementById("output");
                objDiv.scrollTop = objDiv.scrollHeight;
        });

        newSock.on('connect_error', e => {
            console.log('Socket Error', e);
        });


        setSocket(newSock);
    }

    const stopRecog = () => {
        if (socket) {
            socket.close();
        }

        let track = streamRef.current?.getTracks()[0];
        track?.stop();
        inputRef.current?.disconnect(processorRef.current);
        let context = audioContextRef.current;
        processorRef.current?.disconnect(context?.destination);
        context?.close().then(function () {
            inputRef.current = null;
            processorRef.current = null;
            audioContextRef.current = null;
            streamRef.current = null
        });

	    setSocket(null);
        setStarted(false);
    }

    const downsampleBuffer = (buffer, sampleRate, outSampleRate) => {
        if (outSampleRate === sampleRate) {
            return buffer;
        }
        if (outSampleRate > sampleRate) {
            console.log("downsampling rate show be smaller than original sample rate");
        }
        var sampleRateRatio = sampleRate / outSampleRate;
        var newLength = Math.round(buffer.length / sampleRateRatio);
        var result = new Int16Array(newLength);
        var offsetResult = 0;
        var offsetBuffer = 0;
        while (offsetResult < result.length) {
            var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            var accum = 0, count = 0;
            for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }

            result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result.buffer;
    }

    return (
    <div className="App">
        <div className="float-right">
            <a href="https://github.com/danijel3/KaldiWebrtcServer">
                <img width="149" height="149"
                     src="https://github.blog/wp-content/uploads/2008/12/forkme_right_gray_6d6d6d.png?resize=149%2C149"
                     className="attachment-full size-full" alt="Fork me on GitHub"
                     data-recalc-dims="1" />
            </a>
        </div>

        <div className="jumbotron">

            <div className="container">
                <img id="logo" className="display-4 float-left" src={process.env.PUBLIC_URL + "/kaldi_logo.png"} />
                <div>
                    <h1 className="display-4">Speaker Diarization Demo</h1>
                </div>
            </div>
        </div>
        <div className="container">

            <p>
            {
                started ?
                <button className="btn btn-danger" id="stop" onClick={stopRecog}>Stop</button>
                :
                <button className="btn btn-success" id="start" onClick={startRecog}>Start</button>
            }
                <span id="status" className="text-uppercase text-muted">{status}</span>
            </p>

            <div id="output">
            {
                result.map((r, index) => (
                    <span key={"result_"+index}>{r}<br/></span>
                ))
            }
                <span className="partial">{lastTrans}</span>
            </div>
        </div>
    </div>
  );
}

export default App;
