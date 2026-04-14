package com.negotium.card.card.controller;

import com.negotium.card.card.dto.CardCreateRequest;
import com.negotium.card.card.dto.CardResponse;
import com.negotium.card.card.dto.ManualCardCreateRequest;
import com.negotium.card.card.dto.OcrResultUpdateRequest;
import com.negotium.card.card.service.CardService;
import com.negotium.card.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/cards")
@RequiredArgsConstructor
public class CardController {

    private final CardService cardService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CardResponse createCard(
        @Valid @RequestBody CardCreateRequest request,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return cardService.createCard(user.getId(), request);
    }

    @PostMapping("/image")
    @ResponseStatus(HttpStatus.CREATED)
    public CardResponse uploadCardImage(
        @RequestParam("file") MultipartFile file,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return cardService.uploadCardImage(user.getId(), file);
    }

    @PostMapping("/manual")
    @ResponseStatus(HttpStatus.CREATED)
    public CardResponse createManualCard(
        @Valid @RequestBody ManualCardCreateRequest request,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return cardService.createManualCard(user.getId(), request);
    }

    @GetMapping
    public List<CardResponse> getCards(@AuthenticationPrincipal SecurityUser user) {
        return cardService.getCards(user.getId());
    }

    @GetMapping("/{id}")
    public CardResponse getCard(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return cardService.getCard(id, user.getId());
    }

    @PostMapping("/{id}/analyze")
    public CardResponse analyzeCard(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return cardService.analyzeCard(user.getId(), id);
    }

    @PatchMapping("/{id}/ocr")
    public CardResponse updateOcrResult(
        @PathVariable Long id,
        @Valid @RequestBody OcrResultUpdateRequest request,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return cardService.updateOcrResult(user.getId(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCard(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        cardService.deleteCard(user.getId(), id);
    }
}
