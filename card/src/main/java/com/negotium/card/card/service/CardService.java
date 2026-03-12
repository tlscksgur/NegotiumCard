package com.negotium.card.card.service;

import com.negotium.card.card.dto.CardCreateRequest;
import com.negotium.card.card.dto.CardResponse;
import com.negotium.card.entity.Card;
import com.negotium.card.entity.CardStatus;
import com.negotium.card.entity.Person;
import com.negotium.card.entity.User;
import com.negotium.card.file.FileStorageService;
import com.negotium.card.repository.CardRepository;
import com.negotium.card.repository.PersonRepository;
import com.negotium.card.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CardService {

    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final FileStorageService fileStorageService;

    @Transactional
    public CardResponse createCard(Long userId, CardCreateRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found."));

        Person person = null;
        if (request.personId() != null) {
            person = personRepository.findById(request.personId())
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

    @Transactional(readOnly = true)
    public List<CardResponse> getCards(Long userId) {
        return cardRepository.findAllByUserIdWithPerson(userId).stream()
            .map(CardResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public CardResponse getCard(Long cardId, Long userId) {
        Card card = cardRepository.findByIdAndUserId(cardId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found."));

        return CardResponse.from(card);
    }
}
