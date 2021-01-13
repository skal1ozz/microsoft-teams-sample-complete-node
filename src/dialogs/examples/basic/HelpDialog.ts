import * as builder from "botbuilder";
import { TriggerActionDialog } from "../../../utils/TriggerActionDialog";
import { DialogIds } from "../../../utils/DialogIds";
import { DialogMatches } from "../../../utils/DialogMatches";
import { Strings } from "../../../locale/locale";

export class HelpDialog extends TriggerActionDialog {

    private static async step1(session: builder.Session, args?: any | builder.IDialogResult<any>, next?: (args?: builder.IDialogResult<any>) => void): Promise<void> {
        let buttons = new Array<builder.CardAction>();

        let data = {
            type: "task/fetch",
            messageId: "12345",
        };
        let cardAction = new builder.CardAction(session);
        cardAction.type("invoke");
        cardAction.title("Task");
        cardAction.value(JSON.stringify(data));
        buttons.push(cardAction);

        let newCard = new builder.HeroCard(session)
            .text(Strings.help_msg)
            .buttons(buttons);

        session.send(new builder.Message(session)
            .addAttachment(newCard));

        session.endDialog();
    }

    constructor(
        bot: builder.UniversalBot,
    ) {
        super(bot,
            DialogIds.HelpDialogId,
            DialogMatches.HelpDialogMatch,
            HelpDialog.step1,
        );
    }
}
