package com.negotium.card.analyze.service;

import com.negotium.card.analyze.dto.FastApiHealthResponse;
import com.negotium.card.analyze.dto.OcrAnalyzeRequest;
import com.negotium.card.analyze.dto.OcrAnalyzeResponse;
import com.negotium.card.analyze.dto.YoloAnalyzeRequest;
import com.negotium.card.analyze.dto.YoloAnalyzeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
@RequiredArgsConstructor
public class FastApiService {

    private final RestClient fastApiRestClient;

    public FastApiHealthResponse health() {
        return fastApiRestClient.get()
            .uri("/health")
            .retrieve()
            .body(FastApiHealthResponse.class);
    }

    public YoloAnalyzeResponse analyzeYolo(YoloAnalyzeRequest request) {
        return fastApiRestClient.post()
            .uri("/analyze/yolo")
            .body(request)
            .retrieve()
            .body(YoloAnalyzeResponse.class);
    }

    public OcrAnalyzeResponse analyzeOcr(OcrAnalyzeRequest request) {
        return fastApiRestClient.post()
            .uri("/analyze/ocr")
            .body(request)
            .retrieve()
            .body(OcrAnalyzeResponse.class);
    }
}
