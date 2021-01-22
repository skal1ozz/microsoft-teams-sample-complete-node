import * as builder from "botbuilder";
import { RootDialog } from "./dialogs/RootDialog";
import { SetLocaleFromTeamsSetting } from "./middleware/SetLocaleFromTeamsSetting";
import { AdaptiveCardSubmitActionHandler } from "./middleware/AdaptiveCardSubmitActionHandler";
import { StripBotAtMentions } from "./middleware/StripBotAtMentions";
import { RestrictIncomingMessagesToTenants } from "./middleware/RestrictIncomingMessagesToTenants";
import { LoadBotChannelData } from "./middleware/LoadBotChannelData";
import { SimulateResetBotChat } from "./middleware/SimulateResetBotChat";
import { Strings } from "./locale/locale";
import { loadSessionAsync } from "./utils/DialogUtils";
import * as teams from "botbuilder-teams";
import { ComposeExtensionHandlers } from "./composeExtension/ComposeExtensionHandlers";

// =========================================================
// Bot Setup
// =========================================================

export class Bot extends builder.UniversalBot {

    constructor(
        private _connector: teams.TeamsChatConnector,
        private botSettings: any,
    ) {
        super(_connector, botSettings);
        this.set("persistConversationData", true);

        // Root dialog
        new RootDialog(this).createChildDialogs();

        // Add middleware
        this.use(
            // currently this middleware cannot be used because there is an error using it
            // with updating messages examples
            // builder.Middleware.sendTyping(),

            // set on "receive" of incoming payload
            new SetLocaleFromTeamsSetting(),
            new AdaptiveCardSubmitActionHandler(),

            // set on "botbuilder" (after session created)
            new SimulateResetBotChat(this),             // We recommend having this only in non-prod environments, for testing your 1:1 first-run experience
            new StripBotAtMentions(),
            new RestrictIncomingMessagesToTenants(),
            new LoadBotChannelData(this.get("channelStorage")),
        );

        // setup invoke payload handler
        this._connector.onInvoke(this.getInvokeHandler(this));

        // setup O365ConnectorCard action handler
        this._connector.onO365ConnectorCardAction(this.getO365ConnectorCardActionHandler(this));

        // setup conversation update handler for things such as a memberAdded event
        this.on("conversationUpdate", this.getConversationUpdateHandler(this));

        // setup message reaction handler for like and remove like message
        this.on("messageReaction", (event: builder.IMessageUpdate) => {
            this.handleMessageReaction(event);
        });

        // setup popup signin incoming request
        this._connector.onSigninStateVerification((event, query, callback) => {
            this.verifySigninState(event, query, callback);
        });

        // setup compose extension handlers
        // onQuery is for events that come through the compose extension itself including
        // config and auth responses from popups that were started in the compose extension
        // onQuerySettingsUrl is only used when the user selects "Settings" from the three dot option
        // next to the compose extension's name on the list of compose extensions
        // onSettingsUpdate is only used for the response from the popup created by the
        // onQuerySettingsUrl event

        // this._connector.onQuery("Unique_1", ComposeExtensionHandlers.getOnQueryHandler(this));
        this._connector.onQuerySettingsUrl(ComposeExtensionHandlers.getOnQuerySettingsUrlHandler());
        this._connector.onSettingsUpdate(ComposeExtensionHandlers.getOnSettingsUpdateHandler(this));
    }

    // Handle incoming invoke
    private getInvokeHandler(bot: builder.UniversalBot): (event: builder.IEvent, callback: (err: Error, body: any, status?: number) => void) => void {
        return async function (
            event: builder.IEvent,
            callback: (err: Error, body: any, status?: number) => void,
        ): Promise<void>
        {
            console.log("DEBUG::event: ", JSON.stringify(event));
            let session = await loadSessionAsync(bot, event);
            let fetchTemplate: any = "";
            if (session) {
                // Clear the stack on invoke, as many builtin dialogs don't play well with invoke
                // Invoke messages should carry the necessary information to perform their action
                session.clearDialogStack();

                let payload = (event as any).value;

                // Invokes don't participate in middleware
                // If payload has an address, then it is from a button to update a message so we do not what to send typing
                if (!payload.address) {
                    session.sendTyping();
                }

                if (payload && payload.dialog) {
                    session.beginDialog(payload.dialog, payload);
                }
                let invokeType = (event as any).name;
                let invokeValue: any = (event as any).value;
                if (invokeType === undefined) {
                    invokeType = null;
                }
                if (invokeValue === undefined) {
                    invokeValue = null;
                }
                let messagePayload = (event as any).value.messagePayload;
                switch (invokeType) {
                    case "composeExtension/query":
                        fetchTemplate = teams.ComposeExtensionResponse.result("list").attachments([
                            new builder.ThumbnailCard()
                                       .title("Test thumbnail card")
                                       .text("This is a test thumbnail card")
                                       .images([new builder.CardImage().url("https://bot-framework.azureedge.net/bot-icons-v1/bot-framework-default-9.png")])
                                       .toAttachment(),
                        ]).toResponse();
                        break;
                    case "composeExtension/fetchTask":
                        let attachmentCardData = null;
                        if (messagePayload) {
                            for (let i = 0; i < messagePayload.attachments.length; i += 1) {
                                if (messagePayload.attachments[i].contentType === "application/vnd.microsoft.card.adaptive") {
                                    attachmentCardData = messagePayload.attachments[i].content;
                                }
                            }
                        }
                        if (attachmentCardData === null) {
                            attachmentCardData = "no content found";
                        }
                        let card: any = {
                          "type": "AdaptiveCard",
                          "body": [
                            {
                              "type": "ColumnSet",
                              "columns": [
                                {
                                  "type": "Column",
                                  "items": [
                                    {
                                      "type": "Image",
                                      "style": "Person",
                                      "url": "https://pbs.twimg.com/profile_images/3647943215/d7f12830b3c17a5a9e4afcc370e3a37e_400x400.jpeg",
                                      "size": "Small",
                                    },
                                  ],
                                  "width": "auto",
                                },
                                {
                                  "type": "Column",
                                  "items": [
                                    {
                                      "type": "TextBlock",
                                      "weight": "Bolder",
                                      "text": "Matt Hidinger likes your extension",
                                      "wrap": true,
                                    },
                                    {
                                      "type": "TextBlock",
                                      "spacing": "None",
                                      "text": "Created Tue, Jan 21, 2021",
                                      "isSubtle": true,
                                      "wrap": true,
                                    },
                                  ],
                                  "width": "stretch",
                                },
                              ],
                            },
                            {
                              "type": "TextBlock",
                              "text": "Your card:",
                              "wrap": true,
                            },
                            {
                              "type": "Container",
                              "items": [
                                {
                                  "type": "TextBlock",
                                  "text": attachmentCardData,
                                  "wrap": true,
                                },
                              ],
                            },
                          ],
                          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                          "version": "1.3",
                          "actions": [
                            {
                              "type": "Action.Submit",
                              "title": "Create",
                              "data": {
                                "data": {
                                  "hello": "goodbye",
                                },
                              },
                            },
                          ],
                        };
                        if (attachmentCardData.indexOf("{") !== -1) {
                            card.actions.push({
                              "type": "Action.ShowCard",
                              "title": "Show the attachmentCardData as a real card",
                              "card": JSON.parse(attachmentCardData),
                            });
                        }
                        fetchTemplate = {
                            "task": {
                                "type": "continue",
                                "value": {
                                    "title": "Custom Form",
                                    "height": 510,
                                    "width": 430,
                                    "card": {
                                        contentType: "application/vnd.microsoft.card.adaptive",
                                        content: card,
                                    },
                                },
                            },
                        };
                        break;
                    case "task/fetch":
                        fetchTemplate = {
                            "task": {
                                "type": "continue",
                                "value": {
                                    "title": "Custom Form",
                                    "height": 510,
                                    "width": 430,
                                    "fallbackUrl": "https://fake.s1z.info/hello",
                                    "url": "https://fake.s1z.info/hello",
                                },
                            },
                        };
                }
            }
            console.log("========================");
            console.log("callback:", fetchTemplate);
            callback(null, fetchTemplate, 200);
        };
    }

    // set incoming event to any because membersAdded is not a field in builder.IEvent
    private getConversationUpdateHandler(bot: builder.UniversalBot): (event: builder.IConversationUpdate) => void {
        return async function(event: builder.IConversationUpdate): Promise<void> {
            // For sending a welcome message, we are only interested in member add events
            if (!event.membersAdded || (event.membersAdded.length === 0)) {
                return;
            }

            let session = await loadSessionAsync(bot, event);

            // Determine if the bot was added to the conversation
            let botId = event.address.bot.id;
            let botWasAdded = event.membersAdded && event.membersAdded.find(member => (member.id === botId));

            if (!event.address.conversation.isGroup) {
                // 1:1 conversation event
                // If the user hasn't received a first-run message YET, send a message to the user,
                // introducing your bot and what it can do. Do NOT send this blindly, as you can receive
                // spurious conversationUpdate events, especially if you use proactive messaging.

                if (botWasAdded) {
                    if (!session.userData.freSent) {
                        session.userData.freSent = true;
                        session.send(Strings.bot_introduction);
                    } else {
                        // First-run message has already been sent, so skip sending it again
                        // Do not remove the check for "freSent" above. Your bot can receive spurious conversationUpdate
                        // activities from chat service, so if you always respond to all of them, you will send random
                        // welcome messages to users who have already received the welcome.
                    }
                }
            } else {
                // Not 1:1 event (bot or user was added to a team or group chat)

                if (botWasAdded) {
                    // Bot was added to the team
                    // Send a message to the team's channel, introducing your bot and what you can do
                    session.send(Strings.bot_introduction);
                } else {
                    // Other users were added to the team
                }
            }
        };
    }

    // handler for handling incoming payloads from O365ConnectorCard actions
    private getO365ConnectorCardActionHandler(bot: builder.UniversalBot): (event: builder.IEvent, query: teams.IO365ConnectorCardActionQuery, callback: (err: Error, result: any, statusCode: number) => void) => void {
        return async function (event: builder.IEvent, query: teams.IO365ConnectorCardActionQuery, callback: (err: Error, result: any, statusCode: number) => void): Promise<void> {
            let session = await loadSessionAsync(bot, event);

            let userName = event.address.user.name;
            let body = JSON.parse(query.body);
            let msg = new builder.Message(session)
                .text(Strings.o365connectorcard_action_response, userName, query.actionId, JSON.stringify(body, null, 2));

            session.send(msg);

            callback(null, null, 200);
        };
    }

    // method for handling incoming payloads from message reactions
    private async handleMessageReaction(event: builder.IMessageUpdate): Promise<void>
    {
        let session = await loadSessionAsync(this, event);
        if (event.reactionsAdded && event.reactionsAdded[0].type === "like") {
            session.send(Strings.like_message);
        }

        if (event.reactionsRemoved && event.reactionsRemoved[0].type === "like") {
            session.send(Strings.remove_like_message);
        }
    }

    // method for handling incoming payloads from popup signin
    private async verifySigninState (event: builder.IEvent, query: teams.ISigninStateVerificationQuery, callback: (err: Error, body: any, status?: number) => void): Promise<void>
    {
        let session = await loadSessionAsync(this, event);

        if (session)
        {
            let magicNumber = query.state;

            session.clearDialogStack();
            session.send(session.gettext(Strings.popupsignin_successful, magicNumber));
        }
        callback(null, "", 200);
    }
}
