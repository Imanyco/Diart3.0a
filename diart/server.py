import os
import time
from flask import Flask, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/stream')
def stream():

    def get_data():
        
        while True:
            #gotcha
            time.sleep(1)
            yield f'data: hello  \n\n'
    
    return Response(get_data(), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(host='157.230.180.11')