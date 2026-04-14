package com.negotium.card.card.service;

import com.negotium.card.card.dto.CardCreateRequest;
import com.negotium.card.card.dto.CardResponse;
import com.negotium.card.card.dto.ManualCardCreateRequest;
import com.negotium.card.card.dto.OcrResultUpdateRequest;
import com.negotium.card.analyze.service.CardAnalyzeService;
import com.negotium.card.entity.Card;
import com.negotium.card.entity.CardStatus;
import com.negotium.card.entity.OcrResult;
import com.negotium.card.entity.Person;
import com.negotium.card.entity.User;
import com.negotium.card.file.FileStorageService;
import com.negotium.card.organization.service.OrganizationSyncService;
import com.negotium.card.repository.CardRepository;
import com.negotium.card.repository.DetectionResultRepository;
import com.negotium.card.repository.MemoRepository;
import com.negotium.card.repository.OcrResultRepository;
import com.negotium.card.repository.PersonRepository;
import com.negotium.card.repository.PersonTagRepository;
import com.negotium.card.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class CardService {

    private static final long MAX_UPLOAD_SIZE = 10L * 1024 * 1024;
    private static final String MANUAL_CARD_IMAGE_URL = "manual://card-placeholder";
    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of(
        "image/jpeg",
        "image/png",
        "image/webp"
    );

    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final OcrResultRepository ocrResultRepository;
    private final DetectionResultRepository detectionResultRepository;
    private final MemoRepository memoRepository;
    private final PersonTagRepository personTagRepository;
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
    public CardResponse createManualCard(Long userId, ManualCardCreateRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found."));

        Card card = cardRepository.save(Card.builder()
            .user(user)
            .imageUrl(MANUAL_CARD_IMAGE_URL)
            .originalFileName(StringUtils.hasText(request.originalFileName()) ? request.originalFileName().trim() : "manual-entry")
            .status(CardStatus.ANALYZED)
            .build());

        OcrResult ocrResult = ocrResultRepository.save(OcrResult.builder()
            .card(card)
            .rawText(buildRawText(request))
            .name(request.name().trim())
            .company(request.company().trim())
            .department(normalizeNullable(request.department()))
            .position(normalizeNullable(request.position()))
            .email(normalizeNullable(request.email()))
            .phone(normalizeNullable(request.phone()))
            .build());

        card.setOcrResult(ocrResult);
        organizationSyncService.syncFromOcr(card.getId(), userId);
        return getCard(card.getId(), userId);
    }

    @Transactional
    public CardResponse analyzeCard(Long userId, Long cardId) {
        Card card = cardRepository.findByIdAndUserId(cardId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found."));
        if (!isUploadedImage(card.getImageUrl())) {
            throw new IllegalArgumentException("Only uploaded card images can be analyzed.");
        }

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

    @Transactional
    public void deleteCard(Long userId, Long cardId) {
        Card card = cardRepository.findByIdAndUserId(cardId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found."));

        Long personId = card.getPerson() != null ? card.getPerson().getId() : null;
        String imageUrl = card.getImageUrl();

        detectionResultRepository.deleteByCardId(cardId);
        ocrResultRepository.deleteByCardId(cardId);
        cardRepository.delete(card);
        cardRepository.flush();

        if (personId != null && cardRepository.countByPersonId(personId) == 0) {
            memoRepository.deleteByPersonId(personId);
            personTagRepository.deleteByPersonId(personId);
            personRepository.findById(personId).ifPresent(personRepository::delete);
        }

        if (isUploadedImage(imageUrl)) {
            fileStorageService.delete(imageUrl.substring("/api/v1/files/".length()));
        }
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

    private String buildRawText(ManualCardCreateRequest request) {
        if (StringUtils.hasText(request.rawText())) {
            return request.rawText().trim();
        }

        return Stream.of(
                request.name().trim(),
                request.company().trim(),
                request.department(),
                request.position(),
                request.email(),
                request.phone()
            )
            .map(this::normalizeNullable)
            .filter(StringUtils::hasText)
            .reduce((left, right) -> left + "\n" + right)
            .orElse(request.name().trim());
    }

    private String normalizeNullable(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private boolean isUploadedImage(String imageUrl) {
        return StringUtils.hasText(imageUrl) && imageUrl.startsWith("/api/v1/files/");
    }
}
