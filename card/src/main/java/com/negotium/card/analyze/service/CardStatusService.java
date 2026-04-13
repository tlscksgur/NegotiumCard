package com.negotium.card.analyze.service;

import com.negotium.card.entity.Card;
import com.negotium.card.entity.CardStatus;
import com.negotium.card.repository.CardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CardStatusService {

    private final CardRepository cardRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateStatus(Long cardId, Long userId, CardStatus status) {
        Card card = cardRepository.findByIdAndUserId(cardId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found."));
        card.setStatus(status);
        cardRepository.save(card);
    }
}
