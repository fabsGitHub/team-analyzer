package com.teamanalyzer.teamanalyzer.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.teamanalyzer.teamanalyzer.domain.Evaluation;

import java.util.List;
import java.util.UUID;

public interface EvaluationRepository extends JpaRepository<Evaluation, UUID> {
    List<Evaluation> findByTeam(String team);

    @Query("""
              select e.team as team, count(e) as cnt,
                avg(e.appreciation) as a1, avg(e.equality) as a2, avg(e.workload) as a3, avg(e.collegiality) as a4, avg(e.transparency) as a5
              from Evaluation e group by e.team
            """)
    List<Object[]> aggregates();
}