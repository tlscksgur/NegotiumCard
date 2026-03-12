package com.negotium.card.common;

import com.negotium.card.repository.CardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccessGuard {

    private final CardRepository cardRepository;

    public void checkPersonAccess(Long personId, Long userId) {
        if (!cardRepository.existsByPersonIdAndUserId(personId, userId)) {
            throw new IllegalArgumentException("Person is not accessible.");
        }
    }
}
