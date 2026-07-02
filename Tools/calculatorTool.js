else if (selectedTool === "calculator") {

    try {

        let expression = query
            .replace(/calculate/gi, "")
            .replace(/what is/gi, "")
            .replace(/=/g, "")
            .trim();

        const result = Function(`"use strict"; return (${expression})`)();

        return res.json({
            tool: "Calculator",
            answer: `The answer is ${result}`
        });

    } catch (err) {

        return res.json({
            tool: "Calculator",
            answer: "Sorry, I couldn't calculate that."
        });

    }

}