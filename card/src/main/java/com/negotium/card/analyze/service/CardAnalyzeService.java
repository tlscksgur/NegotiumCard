package com.negotium.card.analyze.service;

import com.negotium.card.analyze.dto.CardYoloAnalyzeResponse;
import com.negotium.card.analyze.dto.CardOcrAnalyzeResponse;
import com.negotium.card.analyze.dto.OcrAnalyzeRequest;
import com.negotium.card.analyze.dto.OcrAnalyzeResponse;
import com.negotium.card.analyze.dto.YoloAnalyzeRequest;
import com.negotium.card.analyze.dto.YoloAnalyzeResponse;
import com.negotium.card.card.dto.OcrResultResponse;
import com.negotium.card.entity.Card;
import com.negotium.card.entity.CardStatus;
import com.negotium.card.entity.DetectionResult;
import com.negotium.card.entity.OcrResult;
import com.negotium.card.repository.CardRepository;
import com.negotium.card.repository.DetectionResultRepository;
import com.negotium.card.repository.OcrResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CardAnalyzeService {

    private final CardRepository cardRepository;
    private final DetectionResultRepository detectionResultRepository;
    private final OcrResultRepository ocrResultRepository;
    private final FastApiService fastApiService;

    @Transactional
    public CardYoloAnalyzeResponse analyzeCardYolo(Long cardId, Long userId) {
        Card card = cardRepository.findByIdAndUserId(cardId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found."));

        card.setStatus(CardStatus.ANALYZING);
        cardRepository.save(card);

        try {
            YoloAnalyzeResponse response = fastApiService.analyzeYolo(new YoloAnalyzeRequest(card.getImageUrl()));

            detectionResultRepository.deleteByCardId(cardId);
            detectionResultRepository.saveAll(
                response.detections().stream()
                    .map(detection -> DetectionResult.builder()
                        .card(card)
                        .label(detection.label())
                        .x(detection.x())
                        .y(detection.y())
                        .width(detection.width())
                        .height(detection.height())
                        .confidence(detection.confidence())
                        .build())
                    .toList()
            );

            card.setStatus(CardStatus.ANALYZED);
            cardRepository.save(card);

            return new CardYoloAnalyzeResponse(
                card.getId(),
                card.getImageUrl(),
                CardStatus.ANALYZED.name(),
                response.detections()
            );
        } catch (RuntimeException error) {
            card.setStatus(CardStatus.FAILED);
            cardRepository.save(card);
            throw error;
        }
    }

    @Transactional
    public CardOcrAnalyzeResponse analyzeCardOcr(Long cardId, Long userId) {
        Card card = cardRepository.findByIdAndUserId(cardId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found."));

        card.setStatus(CardStatus.ANALYZING);
        cardRepository.save(card);

        try {
            List<com.negotium.card.analyze.dto.YoloDetectionResponse> detections = detectionResultRepository.findByCardId(cardId).stream()
                .map(detection -> new com.negotium.card.analyze.dto.YoloDetectionResponse(
                    detection.getLabel(),
                    detection.getX(),
                    detection.getY(),
                    detection.getWidth(),
                    detection.getHeight(),
                    detection.getConfidence()
                ))
                .toList();

            OcrAnalyzeResponse response = fastApiService.analyzeOcr(new OcrAnalyzeRequest(card.getImageUrl(), detections));

            OcrResult ocrResult = ocrResultRepository.findByCardId(cardId)
                .map(existing -> updateOcrResult(existing, response))
                .orElseGet(() -> buildOcrResult(card, response));

            OcrResult savedOcrResult = ocrResultRepository.save(ocrResult);
            card.setOcrResult(savedOcrResult);
            card.setStatus(CardStatus.ANALYZED);
            cardRepository.save(card);

            return new CardOcrAnalyzeResponse(
                card.getId(),
                card.getImageUrl(),
                CardStatus.ANALYZED.name(),
                OcrResultResponse.from(savedOcrResult)
            );
        } catch (RuntimeException error) {
            card.setStatus(CardStatus.FAILED);
            cardRepository.save(card);
            throw error;
        }
    }

    private OcrResult buildOcrResult(Card card, OcrAnalyzeResponse response) {
        return OcrResult.builder()
            .card(card)
            .rawText(response.rawText())
            .name(response.name())
            .company(response.company())
            .department(response.department())
            .position(response.position())
            .email(response.email())
            .phone(response.phone())
            .build();
    }

    private OcrResult updateOcrResult(OcrResult ocrResult, OcrAnalyzeResponse response) {
        ocrResult.setRawText(response.rawText());
        ocrResult.setName(response.name());
        ocrResult.setCompany(response.company());
        ocrResult.setDepartment(response.department());
        ocrResult.setPosition(response.position());
        ocrResult.setEmail(response.email());
        ocrResult.setPhone(response.phone());
        return ocrResult;
    }
}
