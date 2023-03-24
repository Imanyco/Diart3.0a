FROM python:3.10-slim-bullseye
# FROM alpine:latest
WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y build-essential libportaudio2 libportaudiocpp0 portaudio19-dev python3-dev libsndfile1
RUN pip install torch==1.13.0 torchvision==0.14.0 torchaudio==0.13.0 --extra-index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install python-socketio==5.4.0
COPY . . 
CMD [ "python", "server.py", "--port", "8888" ]