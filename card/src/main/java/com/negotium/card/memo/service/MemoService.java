package com.negotium.card.memo.service;

import com.negotium.card.common.AccessGuard;
import com.negotium.card.entity.Memo;
import com.negotium.card.entity.Person;
import com.negotium.card.entity.User;
import com.negotium.card.memo.dto.MemoCreateRequest;
import com.negotium.card.memo.dto.MemoResponse;
import com.negotium.card.repository.MemoRepository;
import com.negotium.card.repository.PersonRepository;
import com.negotium.card.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MemoService {

    private final MemoRepository memoRepository;
    private final PersonRepository personRepository;
    private final UserRepository userRepository;
    private final AccessGuard accessGuard;

    @Transactional
    public MemoResponse createMemo(Long userId, MemoCreateRequest request) {
        accessGuard.checkPersonAccess(request.personId(), userId);

        Person person = personRepository.findById(request.personId())
            .orElseThrow(() -> new IllegalArgumentException("Person not found."));
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found."));

        Memo memo = memoRepository.save(Memo.builder()
            .person(person)
            .user(user)
            .content(request.content())
            .build());

        return MemoResponse.from(memo);
    }

    @Transactional(readOnly = true)
    public List<MemoResponse> getMemos(Long personId, Long userId) {
        accessGuard.checkPersonAccess(personId, userId);
        return memoRepository.findByPersonIdAndUserId(personId, userId).stream()
            .map(MemoResponse::from)
            .toList();
    }
}
