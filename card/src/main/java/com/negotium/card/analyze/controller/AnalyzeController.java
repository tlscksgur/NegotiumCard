package com.negotium.card.analyze.controller;

import com.negotium.card.analyze.dto.CardYoloAnalyzeResponse;
import com.negotium.card.analyze.dto.CardOcrAnalyzeResponse;
import com.negotium.card.analyze.dto.FastApiHealthResponse;
import com.negotium.card.analyze.dto.OcrAnalyzeRequest;
import com.negotium.card.analyze.dto.OcrAnalyzeResponse;
import com.negotium.card.analyze.dto.YoloAnalyzeRequest;
import com.negotium.card.analyze.dto.YoloAnalyzeResponse;
import com.negotium.card.analyze.service.CardAnalyzeService;
import com.negotium.card.analyze.service.FastApiService;
import com.negotium.card.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analyze")
@RequiredArgsConstructor
public class AnalyzeController {

    private final FastApiService fastApiService;
    private final CardAnalyzeService cardAnalyzeService;

    @GetMapping("/health")
    public FastApiHealthResponse health(@AuthenticationPrincipal Object ignored) {
        return fastApiService.health();
    }

    @PostMapping("/yolo")
    public YoloAnalyzeResponse analyzeYolo(@Valid @RequestBody YoloAnalyzeRequest request) {
        return fastApiService.analyzeYolo(request);
    }

    @PostMapping("/ocr")
    public OcrAnalyzeResponse analyzeOcr(@Valid @RequestBody OcrAnalyzeRequest request) {
        return fastApiService.analyzeOcr(request);
    }

    @PostMapping("/cards/{cardId}/yolo")
    public CardYoloAnalyzeResponse analyzeCardYolo(
        @PathVariable Long cardId,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return cardAnalyzeService.analyzeCardYolo(cardId, user.getId());
    }

    @PostMapping("/cards/{cardId}/ocr")
    public CardOcrAnalyzeResponse analyzeCardOcr(
        @PathVariable Long cardId,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return cardAnalyzeService.analyzeCardOcr(cardId, user.getId());
    }
}
