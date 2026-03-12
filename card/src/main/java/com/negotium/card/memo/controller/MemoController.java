package com.negotium.card.memo.controller;

import com.negotium.card.memo.dto.MemoCreateRequest;
import com.negotium.card.memo.dto.MemoResponse;
import com.negotium.card.memo.service.MemoService;
import com.negotium.card.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class MemoController {

    private final MemoService memoService;

    @PostMapping("/api/v1/memos")
    @ResponseStatus(HttpStatus.CREATED)
    public MemoResponse createMemo(
        @Valid @RequestBody MemoCreateRequest request,
        @AuthenticationPrincipal SecurityUser user
    ) {
        return memoService.createMemo(user.getId(), request);
    }

    @GetMapping("/api/v1/persons/{id}/memos")
    public List<MemoResponse> getMemos(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return memoService.getMemos(id, user.getId());
    }
}
