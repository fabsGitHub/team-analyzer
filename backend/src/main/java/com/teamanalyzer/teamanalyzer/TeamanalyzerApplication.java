package com.teamanalyzer.teamanalyzer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
@ConfigurationPropertiesScan("com.teamanalyzer.teamanalyzer")
@EnableJpaAuditing
public class TeamanalyzerApplication {

	public static void main(String[] args) {
		SpringApplication.run(TeamanalyzerApplication.class, args);
	}

}
