package com.negotium.card.card.service;

import com.negotium.card.card.dto.CardCreateRequest;
import com.negotium.card.card.dto.CardResponse;
import com.negotium.card.card.dto.OcrResultUpdateRequest;
import com.negotium.card.analyze.service.CardAnalyzeService;
import com.negotium.card.entity.Card;
import com.negotium.card.entity.CardStatus;
import com.negotium.card.entity.Person;
import com.negotium.card.entity.User;
import com.negotium.card.file.FileStorageService;
import com.negotium.card.organization.service.OrganizationSyncService;
import com.negotium.card.repository.CardRepository;
import com.negotium.card.repository.OcrResultRepository;
import com.negotium.card.repository.PersonRepository;
import com.negotium.card.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CardService {

    private static final long MAX_UPLOAD_SIZE = 10L * 1024 * 1024;
    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of(
        "image/jpeg",
        "image/png",
        "image/webp"
    );

    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final OcrResultRepository ocrResultRepository;
    private final FileStorageService fileStorageService;
    private final CardAnalyzeService cardAnalyzeService;
    private final OrganizationSyncService organizationSyncService;

    @Transactional
    public CardResponse createCard(Long userId, CardCreateRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found."));

        Person person = null;
        if (request.personId() != null) {
            person = personRepository.findAccessiblePerson(request.personId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("Person not found."));
        }

        Card card = cardRepository.save(Card.builder()
            .user(user)
            .person(person)
            .imageUrl(request.imageUrl())
            .originalFileName(request.originalFileName())
            .status(request.status() != null ? request.status() : CardStatus.UPLOADED)
            .build());

        return CardResponse.from(card);
    }

    @Transactional
    public CardResponse uploadCardImage(Long userId, MultipartFile file) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found."));

        validateUpload(file);

        String storedFileName = fileStorageService.store(file);
        String imageUrl = "/api/v1/files/" + storedFileName;

        Card card = cardRepository.save(Card.builder()
            .user(user)
            .imageUrl(imageUrl)
            .originalFileName(file.getOriginalFilename())
            .status(CardStatus.UPLOADED)
            .build());

        return CardResponse.from(card);
    }

    @Transactional
    public CardResponse analyzeCard(Long userId, Long cardId) {
        cardAnalyzeService.analyzeCardYolo(cardId, userId);
        cardAnalyzeService.analyzeCardOcr(cardId, userId);
        organizationSyncService.syncFromOcr(cardId, userId);
        return getCard(cardId, userId);
    }

    @Transactional
    public CardResponse updateOcrResult(Long userId, Long cardId, OcrResultUpdateRequest request) {
        organizationSyncService.updateOcrAndSync(cardId, userId, request);
        return getCard(cardId, userId);
    }

    @Transactional(readOnly = true)
    public List<CardResponse> getCards(Long userId) {
        return cardRepository.findAllByUserIdWithPerson(userId).stream()
            .peek(this::attachOcrResult)
            .map(CardResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public CardResponse getCard(Long cardId, Long userId) {
        Card card = cardRepository.findByIdAndUserId(cardId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found."));

        attachOcrResult(card);
        return CardResponse.from(card);
    }

    private void attachOcrResult(Card card) {
        ocrResultRepository.findByCardId(card.getId()).ifPresent(card::setOcrResult);
    }

    private void validateUpload(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty.");
        }
        if (file.getSize() > MAX_UPLOAD_SIZE) {
            throw new IllegalArgumentException("File size must be 10MB or less.");
        }

        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType) || !SUPPORTED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Unsupported image format.");
        }
    }
}
