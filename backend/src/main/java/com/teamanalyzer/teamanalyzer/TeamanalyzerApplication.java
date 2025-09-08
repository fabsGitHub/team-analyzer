package com.teamanalyzer.teamanalyzer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class TeamanalyzerApplication {

	public static void main(String[] args) {
		SpringApplication.run(TeamanalyzerApplication.class, args);
	}

}
