#!/bin/bash

# This script installs all of the necessary dependencies

apt-get update apt-get install libsndfile1 libportaudio2 -y
pip install torch==1.13.0 torchvision==0.14.0 torchaudio==0.13.0 --extra-index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
pip install python-socketio==5.4.0

print('All dependencies installed successfully')

python server.py
