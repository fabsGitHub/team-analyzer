package com.teamanalyzer.teamanalyzer.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.teamanalyzer.teamanalyzer.domain.SurveyToken;

public interface SurveyTokenRepository extends JpaRepository<SurveyToken, UUID> {

        long countBySurveyIdAndRedeemedAtIsNotNull(UUID surveyId);

        // aktives Token (nicht eingelöst, nicht revoked) eines Users für ein Survey
        Optional<SurveyToken> findFirstBySurvey_IdAndIssuedToUser_IdAndRedeemedFalseAndRevokedFalse(
                        UUID surveyId, UUID userId);

        // (optional) alle Tokens eines Users für Anzeige
        List<SurveyToken> findByIssuedToUser_IdAndSurvey_Id(UUID userId, UUID surveyId);

        @Query("""
                        select t from SurveyToken t
                          join fetch t.survey s
                         where t.issuedToUser.id = :userId
                           and t.revoked = false
                           and t.redeemed = false
                         order by t.issuedAt desc
                        """)
        List<SurveyToken> findOpenByUser(UUID userId);

        @Modifying(clearAutomatically = true, flushAutomatically = true)
        @Query("""
                        update SurveyToken t
                           set t.revoked = true,
                               t.revokedAt = CURRENT_TIMESTAMP
                         where t.survey.id = :surveyId
                           and t.issuedToUser.id = :userId
                           and t.redeemed = false
                           and t.revoked = false
                        """)
        int revokeActiveForUser(UUID surveyId, UUID userId);

        /** Lookup beim Redeem (Hash + Survey). */
        Optional<SurveyToken> findByTokenHashAndSurvey_Id(byte[] tokenHash, UUID surveyId);
}
