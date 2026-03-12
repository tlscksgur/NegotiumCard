package com.negotium.card.repository;

import com.negotium.card.entity.OcrResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OcrResultRepository extends JpaRepository<OcrResult, Long> {

    Optional<OcrResult> findByCardId(Long cardId);
}
