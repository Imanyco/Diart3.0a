
import queue
import diart.sources as src
import numpy as np
import torch
from diart import utils
from diart.blocks import OnlineSpeakerDiarization, PipelineConfig
from diart.inference import RealTimeInference
from diart.models import SegmentationModel, EmbeddingModel
import json

# from diart.sinks import RTTMWriter


class RealTimeDiart:
    def __init__(self, hf_token):
        self.hf_token = hf_token
        source = "stream_source"
        sample_rate = 16000
        stream_padding = 0.0
        block_size = 8000
        self.audio_source = src.StreamAudioSource(source, sample_rate, stream_padding, block_size)
        self.result_queue = queue.Queue(maxsize=100)

    def stream_annote(self, final_annote):
        for seg_st, seg_end, spk_name, text in final_annote:
            res_dict = {
                text : "diarization result",
                "spk" : [spk_name, seg_st, seg_end]
            }
            self.result_queue.put(json.dumps(res_dict))
        #print(final_annote)

    def get_result(self):
        response = []
        if self.result_queue.qsize() > 0:
            response = [self.result_queue.get()]
        return response

    def make_input_stream(self, frame):
        self.audio_source.put_frame(frame)

    def stop(self):
        self.audio_source.close()

    def start(self):
        segmentation = "pyannote/segmentation"
        embedding = "pyannote/embedding"
        step = 0.5
        latency = 0.5
        tau = 0.5
        rho = 0.3
        delta = 1
        gamma = 3
        beta = 10
        max_speakers = 20
        no_plot = False
        cpu = "cpu"
        output = "./"
        hf_token = ""

        device = torch.device("cpu")
        hf_token = utils.parse_hf_token_arg(hf_token)

        # Download pyannote models (or get from cache)
        segmentation = SegmentationModel.from_pyannote(segmentation, self.hf_token)
        embedding = EmbeddingModel.from_pyannote(embedding, self.hf_token)

        # Define online speaker diarization pipeline
        config = PipelineConfig(
            segmentation = segmentation,
            embedding = embedding,
            duration = None,
            step = step,
            latency = None,
            tau_active = tau,
            rho_update = rho,
            delta_new = delta,
            gamma = gamma,
            beta = beta,
            max_speakers = max_speakers,
            device = device
        )

        pipeline = OnlineSpeakerDiarization(config)

        # Manage audio source
        block_size = int(np.rint(config.step * config.sample_rate))
        source = "streamsource"
        stream_padding = config.latency - config.step
        # audio_source = src.FileAudioSource(args.source, config.sample_rate, stream_padding, block_size)
        #self.audio_source = src.StreamAudioSource(source, config.sample_rate, stream_padding, block_size)

        # Run online inference
        inference = RealTimeInference(
            pipeline,
            self.audio_source,
            batch_size=1,
            do_profile=True,
            #do_plot=True,
            do_plot=no_plot,
            show_progress=True,
            leave_progress_bar=True,
        )

        from diart.sinks import StreamAnnote
        inference.attach_observers(StreamAnnote(self.audio_source.uri, self.stream_annote))
        inference()
        # print(inference.accumulator.get_prediction())


if __name__ == "__main__":
    diarizer = RealTimeDiart("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")
    diarizer.start()
