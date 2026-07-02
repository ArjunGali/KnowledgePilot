else if (selectedTool === "date") {

    const now = new Date();

    return res.json({

        tool: "Date",

        answer: `Today's date is ${now.toDateString()} and the current time is ${now.toLocaleTimeString()}`

    });

}