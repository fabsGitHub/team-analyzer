package com.teamanalyzer.teamanalyzer.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.teamanalyzer.teamanalyzer.domain.Survey;

public interface SurveyRepository extends JpaRepository<Survey, UUID> {
    Optional<Survey> findByIdAndTeamId(UUID id, UUID teamId);

    boolean existsByIdAndTeam_Members_User_Id(UUID surveyId, UUID userId);

    boolean existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(UUID surveyId, UUID userId);

    @EntityGraph(attributePaths = "questions")
    List<Survey> findByCreatedBy(UUID createdBy);

    @Query("""
              select distinct s
              from Survey s
                join fetch s.team t
                left join fetch s.questions q
              where s.createdBy = :uid
              order by s.id desc
            """)
    List<Survey> findByCreatedByWithTeamAndQuestions(@Param("uid") UUID uid);

    // Team-ID zu einem Survey ermitteln (sauberer Name!)
    @Query("select s.team.id from Survey s where s.id = :id")
    Optional<UUID> findTeamIdById(UUID id);
}
